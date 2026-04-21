import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  // Collect all query params, redact code to first 10 chars
  const paramsForLog: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    paramsForLog[key] =
      key === "code" ? `${value.slice(0, 10)}... (${value.length} chars)` : value;
  });
  console.log("[auth/callback] incoming GET", { origin, params: paramsForLog });

  // Supabase itself may redirect back here with error params if the upstream
  // (Google) exchange failed. Surface it explicitly.
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  if (errorParam) {
    console.error("[auth/callback] Supabase returned an error to the callback", {
      error: errorParam,
      error_code: searchParams.get("error_code"),
      error_description: errorDescription,
    });
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorParam)}`,
    );
  }

  if (!code) {
    console.error("[auth/callback] no `code` param in callback URL");
    return NextResponse.redirect(`${origin}/login?error=no_code`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth/callback] exchangeCodeForSession failed", {
      name: error.name,
      message: error.message,
      status: error.status,
      code: error.code,
    });
    return NextResponse.redirect(`${origin}/login?error=exchange_failed`);
  }

  console.log("[auth/callback] exchangeCodeForSession succeeded", {
    hasSession: !!data.session,
    hasUser: !!data.user,
    userId: data.user?.id,
    userEmail: data.user?.email,
    provider: data.user?.app_metadata?.provider,
    expiresAt: data.session?.expires_at,
  });

  // Sanity check: re-read via getUser() to confirm cookies are actually set
  // for subsequent requests.
  const {
    data: { user: verifiedUser },
    error: verifyError,
  } = await supabase.auth.getUser();
  console.log("[auth/callback] post-exchange getUser()", {
    verifiedUserId: verifiedUser?.id,
    verifyError: verifyError?.message,
  });

  return NextResponse.redirect(`${origin}${next}`);
}
