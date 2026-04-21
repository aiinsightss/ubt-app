import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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
  await supabase.auth.getUser();

  return supabaseResponse;
}
