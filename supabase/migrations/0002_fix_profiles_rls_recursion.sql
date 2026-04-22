-- =============================================================================
-- 0002 — Fix infinite recursion in profiles RLS (admin policy)
-- =============================================================================
--
-- Problem: the `profiles_admin_all` policy in migration 0001 queries
-- `public.profiles` inside its own USING/WITH CHECK clause to check whether
-- the current user has role = 'admin'. Every such sub-SELECT re-evaluates
-- all RLS policies on `profiles`, including `profiles_admin_all` itself,
-- which loops and Postgres raises error 42P17
-- ("infinite recursion detected in policy for relation profiles").
--
-- Because RLS is checked on every SELECT/UPDATE to `profiles` for the
-- `authenticated` role, this blocks ALL reads and writes to profiles
-- from any non-admin user — breaking onboarding, dashboard, settings, etc.
--
-- Fix: move the admin check into a SECURITY DEFINER function that runs as
-- the function owner and therefore bypasses RLS on its internal SELECT.
-- The policy then calls the function, which never re-enters RLS, so no
-- recursion.
--
-- Only `profiles_admin_all` in 0001 has this pattern; no other table's
-- policies sub-SELECT from `profiles`, so the fix is scoped to this file.
-- =============================================================================

begin;

-- Helper: returns true iff the given user is an admin.
-- SECURITY DEFINER so the internal SELECT runs as the function owner
-- (postgres) and bypasses RLS — this is what breaks the recursion cycle.
-- STABLE so Postgres can cache the result within a single query.
-- Explicit search_path hardens against search_path hijacking attacks, which
-- are the classic risk with SECURITY DEFINER functions.
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = uid and role = 'admin'
  );
$$;

-- Lock down who can call it. RLS policies run as the table owner and can
-- still invoke it; we just don't want anon or unauthenticated callers
-- hammering it directly.
revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated, service_role;

-- Replace the recursive policy with one that delegates to is_admin().
drop policy if exists profiles_admin_all on public.profiles;

create policy profiles_admin_all
  on public.profiles for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

commit;
