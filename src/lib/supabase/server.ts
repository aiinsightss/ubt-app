import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
            console.log("[supabase/server] setAll wrote cookies", {
              cookieNames: cookiesToSet.map((c) => c.name),
            });
          } catch (e) {
            // Called from a Server Component — cookies can't be set here.
            // The proxy refreshes the session on every request, so this is safe
            // for Server Components. But it's NOT safe in Route Handlers, where
            // this would silently lose the session — so we warn loudly.
            console.warn(
              "[supabase/server] cookieStore.set threw (expected in Server Components, NOT OK in Route Handlers):",
              e instanceof Error ? e.message : e,
            );
          }
        },
      },
    },
  );
}
