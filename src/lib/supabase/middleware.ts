import { createServerClient } from "@supabase/ssr";
import {
  NextResponse,
  type NextRequest,
  type NextResponse as NextResponseType,
} from "next/server";
import type { User } from "@supabase/supabase-js";

const PROTECTED_PREFIXES = ["/dashboard", "/onboarding", "/settings", "/offers"];

const ADVERTISER_ONLY_PATHS = ["/offers/new"];

function isAdvertiserOnly(pathname: string): boolean {
  return ADVERTISER_ONLY_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function handleRoleRouting(
  request: NextRequest,
  user: User | null,
): NextResponseType | null {
  const { pathname } = request.nextUrl;

  // Never interfere with the OAuth callback.
  if (pathname.startsWith("/auth/")) return null;

  // Not logged in: block protected routes.
  if (!user) {
    if (isProtected(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    return null;
  }

  const role =
    typeof user.user_metadata?.role === "string"
      ? (user.user_metadata.role as string)
      : undefined;

  // Logged in on /login → push them forward.
  if (pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = role ? "/dashboard" : "/onboarding";
    return NextResponse.redirect(url);
  }

  // Logged in with role, but sitting on /onboarding → send to dashboard.
  if (role && pathname === "/onboarding") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Logged in without role → force onboarding (except landing & onboarding itself).
  if (
    !role &&
    pathname !== "/" &&
    !pathname.startsWith("/onboarding")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/onboarding";
    return NextResponse.redirect(url);
  }

  return null;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          if (request.nextUrl.pathname.startsWith("/auth/")) {
            console.log("[proxy] setAll on auth route", {
              path: request.nextUrl.pathname,
              cookieNames: cookiesToSet.map((c) => c.name),
            });
          }
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refreshes the auth token if expired and writes updated cookies to the response.
  // Must be called before any code that might short-circuit the response.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const redirectResponse = handleRoleRouting(request, user);
  if (redirectResponse) {
    // Copy refreshed auth cookies onto the redirect so the session survives.
    for (const cookie of supabaseResponse.cookies.getAll()) {
      redirectResponse.cookies.set(cookie);
    }
    return redirectResponse;
  }

  // Advertiser-only paths: non-advertisers get redirected with an error param.
  if (isAdvertiserOnly(request.nextUrl.pathname)) {
    const role = user?.user_metadata?.role;
    if (role !== "advertiser") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      url.searchParams.set("error", "advertiser_only");
      const redirect = NextResponse.redirect(url);
      for (const cookie of supabaseResponse.cookies.getAll()) {
        redirect.cookies.set(cookie);
      }
      return redirect;
    }
  }

  return supabaseResponse;
}
