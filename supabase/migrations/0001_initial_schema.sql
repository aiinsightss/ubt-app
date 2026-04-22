-- =============================================================================
-- UBT Marketplace — initial schema (0001)
-- Sections:
--   1. ENUMS
--   2. TABLES
--   3. INDEXES
--   4. FUNCTIONS (trigger bodies + helpers)
--   5. TRIGGERS
--   6. RLS POLICIES + column privileges + public views
--   7. MATERIALIZED VIEWS (leaderboards)
--   8. SEED DATA (levels_config)
-- =============================================================================


-- =============================================================================
-- 1. ENUMS
-- =============================================================================

create type user_role           as enum ('creator', 'advertiser', 'admin');
create type platform            as enum ('tiktok', 'instagram', 'youtube');
create type verticality_tier    as enum ('white', 'grey', 'black');
create type payout_type         as enum ('cpm', 'cpa', 'hybrid');
create type offer_status        as enum ('draft', 'active', 'paused', 'ended');
create type submission_status   as enum ('pending', 'approved', 'rejected', 'paid');
create type conversion_status   as enum ('pending', 'approved', 'rejected');
create type transaction_type    as enum ('deposit', 'withdrawal', 'earning', 'spending', 'refund');
create type transaction_status  as enum ('pending', 'processing', 'completed', 'failed');
create type event_type          as enum (
  'click', 'registration', 'first_deposit', 'deposit',
  'conversion_approved', 'conversion_rejected'
);


-- =============================================================================
-- 2. TABLES
-- =============================================================================

-- --- profiles (1-to-1 with auth.users) -------------------------------------
create table public.profiles (
  id                      uuid primary key references auth.users(id) on delete cascade,
  role                    user_role,
  nickname                text unique not null,
  full_name               text,
  avatar_url              text,
  bio                     text,
  xp                      bigint not null default 0,
  level                   integer not null default 1,
  -- aggregates (maintained by triggers)
  total_views             bigint         not null default 0,
  total_clicks            bigint         not null default 0,
  total_registrations     bigint         not null default 0,
  total_first_deposits    bigint         not null default 0,
  total_deposits_sum      numeric(14,2)  not null default 0,
  total_earned            numeric(14,2)  not null default 0,
  total_spent             numeric(14,2)  not null default 0,
  avg_cpm_earned          numeric(10,4)  not null default 0,
  best_epc                numeric(10,4)  not null default 0,
  -- advertiser-specific
  company_name            text,
  -- contacts
  telegram_username       text,
  telegram_user_id        bigint,
  telegram_verified       boolean not null default false,
  -- flags
  leaderboard_visible     boolean not null default true,
  onboarded_at            timestamptz,
  banned                  boolean not null default false,
  banned_reason           text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- --- social_accounts --------------------------------------------------------
create table public.social_accounts (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references public.profiles(id) on delete cascade,
  platform                platform not null,
  username                text not null,
  verified                boolean not null default false,
  verification_code       text,
  verification_expires_at timestamptz,
  followers               bigint not null default 0,
  total_views             bigint not null default 0,
  total_likes             bigint not null default 0,
  last_synced_at          timestamptz,
  created_at              timestamptz not null default now(),
  unique (platform, username)
);

-- --- offers -----------------------------------------------------------------
create table public.offers (
  id                      uuid primary key default gen_random_uuid(),
  advertiser_id           uuid not null references public.profiles(id) on delete restrict,
  title                   text not null,
  description             text,
  vertical                text not null,
  verticality_tier        verticality_tier not null default 'grey',
  payout_type             payout_type not null,
  cpm_rate                numeric(10,4)  not null default 0,
  cpa_rate                numeric(10,2)  not null default 0,
  budget_total            numeric(14,2)  not null,
  budget_spent            numeric(14,2)  not null default 0,
  geo                     text[]         not null default '{}',
  rules                   text,
  mandatory_points        jsonb          not null default '[]'::jsonb,
  cpa_link_template       text,
  status                  offer_status   not null default 'draft',
  deadline                timestamptz,
  -- aggregates
  total_views             bigint         not null default 0,
  total_submissions       integer        not null default 0,
  total_clicks            bigint         not null default 0,
  total_registrations     bigint         not null default 0,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- --- submissions ------------------------------------------------------------
create table public.submissions (
  id                      uuid primary key default gen_random_uuid(),
  creator_id              uuid not null references public.profiles(id) on delete restrict,
  offer_id                uuid not null references public.offers(id) on delete restrict,
  social_account_id       uuid references public.social_accounts(id) on delete set null,
  video_url               text not null,
  platform                platform not null,
  external_video_id       text,
  -- CPM metrics
  views                   bigint not null default 0,
  likes                   bigint not null default 0,
  comments                bigint not null default 0,
  shares                  bigint not null default 0,
  -- CPA metrics
  clicks                  bigint not null default 0,
  registrations           bigint not null default 0,
  first_deposits          bigint not null default 0,
  total_deposits_count    bigint not null default 0,
  total_deposits_sum      numeric(14,2) not null default 0,
  -- earnings
  earnings_cpm            numeric(14,2) not null default 0,
  earnings_cpa            numeric(14,2) not null default 0,
  -- status
  status                  submission_status not null default 'pending',
  rejection_reason        text,
  subaccount_token        text unique not null
                          default encode(gen_random_bytes(8), 'hex'),
  last_synced_at          timestamptz,
  submitted_at            timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (video_url, offer_id)
);

-- --- submission_events (raw CPA postback log) -------------------------------
create table public.submission_events (
  id               uuid primary key default gen_random_uuid(),
  submission_id    uuid not null references public.submissions(id) on delete cascade,
  event_type       event_type not null,
  amount           numeric(14,2),
  external_user_id text,
  raw_payload      jsonb,
  created_at       timestamptz not null default now()
);

-- --- conversions ------------------------------------------------------------
create table public.conversions (
  id                      uuid primary key default gen_random_uuid(),
  submission_id           uuid not null references public.submissions(id) on delete cascade,
  external_transaction_id text,
  amount                  numeric(14,2) not null,
  status                  conversion_status not null default 'pending',
  created_at              timestamptz not null default now(),
  approved_at             timestamptz
);

-- --- transactions -----------------------------------------------------------
create table public.transactions (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references public.profiles(id) on delete restrict,
  type                    transaction_type not null,
  amount                  numeric(14,2) not null,
  currency                text not null default 'USDT',
  crypto_tx_hash          text,
  status                  transaction_status not null default 'pending',
  related_submission_id   uuid references public.submissions(id) on delete set null,
  notes                   text,
  created_at              timestamptz not null default now(),
  processed_at            timestamptz
);

-- --- levels_config ----------------------------------------------------------
-- NOTE: spec said `level integer PK`; changed to composite (role, level)
-- because the same level numbers (1..10) repeat for creator and advertiser.
create table public.levels_config (
  role           user_role not null,
  level          integer   not null,
  title          text      not null,
  min_xp         bigint    not null,
  perks          jsonb     not null default '[]'::jsonb,
  avatar_stage   text,
  primary key (role, level)
);

-- --- achievements -----------------------------------------------------------
create table public.achievements (
  id           uuid primary key default gen_random_uuid(),
  code         text unique not null,
  title        text not null,
  description  text,
  icon_url     text,
  condition    jsonb not null,
  role         user_role,
  created_at   timestamptz not null default now()
);

-- --- user_achievements ------------------------------------------------------
create table public.user_achievements (
  user_id        uuid not null references public.profiles(id) on delete cascade,
  achievement_id uuid not null references public.achievements(id) on delete cascade,
  unlocked_at    timestamptz not null default now(),
  primary key (user_id, achievement_id)
);


-- =============================================================================
-- 3. INDEXES
-- =============================================================================

create index idx_profiles_role                on public.profiles(role);
create index idx_profiles_total_views_desc    on public.profiles(total_views desc);
create index idx_profiles_total_earned_desc   on public.profiles(total_earned desc);
create index idx_profiles_nickname            on public.profiles(nickname);

create index idx_social_accounts_user_id      on public.social_accounts(user_id);

create index idx_offers_status_created        on public.offers(status, created_at desc);
create index idx_offers_advertiser_id         on public.offers(advertiser_id);
create index idx_offers_vertical_status       on public.offers(vertical, status);
create index idx_offers_total_views_desc      on public.offers(total_views desc);

create index idx_submissions_creator_sub      on public.submissions(creator_id, submitted_at desc);
create index idx_submissions_offer_sub        on public.submissions(offer_id, submitted_at desc);
create index idx_submissions_subaccount_token on public.submissions(subaccount_token);
create index idx_submissions_status           on public.submissions(status);
create index idx_submissions_social_account   on public.submissions(social_account_id);

create index idx_submission_events_sub_created on public.submission_events(submission_id, created_at desc);
create index idx_submission_events_type        on public.submission_events(event_type, created_at desc);

create index idx_conversions_submission        on public.conversions(submission_id);
create index idx_conversions_status            on public.conversions(status);

create index idx_transactions_user_created     on public.transactions(user_id, created_at desc);
create index idx_transactions_status           on public.transactions(status);
create index idx_transactions_related_sub      on public.transactions(related_submission_id);

create index idx_user_achievements_user        on public.user_achievements(user_id);
create index idx_user_achievements_ach         on public.user_achievements(achievement_id);


-- =============================================================================
-- 4. FUNCTIONS
-- =============================================================================

-- --- generic: touch updated_at on UPDATE ------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- --- auth.users insert → public.profiles ------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  generated_nickname text;
begin
  -- default nickname: user_<first 8 hex chars of uuid>
  generated_nickname := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);

  insert into public.profiles (id, nickname, full_name, avatar_url)
  values (
    new.id,
    generated_nickname,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name'
    ),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

-- --- submissions: recalc earnings_cpm when views/cpm_rate change ------------
create or replace function public.submissions_calc_earnings_cpm()
returns trigger
language plpgsql
as $$
declare
  rate numeric(10,4);
begin
  select cpm_rate into rate from public.offers where id = new.offer_id;
  new.earnings_cpm := round((new.views * coalesce(rate, 0)) / 1000.0, 2);
  return new;
end;
$$;

-- --- submission_events → recalc CPA counters on submission ------------------
create or replace function public.update_submission_metrics()
returns trigger
language plpgsql
as $$
declare
  target_submission uuid;
begin
  target_submission := coalesce(new.submission_id, old.submission_id);

  update public.submissions s
  set
    clicks               = (select count(*) from public.submission_events e
                            where e.submission_id = target_submission
                              and e.event_type    = 'click'),
    registrations        = (select count(*) from public.submission_events e
                            where e.submission_id = target_submission
                              and e.event_type    = 'registration'),
    first_deposits       = (select count(*) from public.submission_events e
                            where e.submission_id = target_submission
                              and e.event_type    = 'first_deposit'),
    total_deposits_count = (select count(*) from public.submission_events e
                            where e.submission_id = target_submission
                              and e.event_type in ('first_deposit', 'deposit')),
    total_deposits_sum   = (select coalesce(sum(amount), 0) from public.submission_events e
                            where e.submission_id = target_submission
                              and e.event_type in ('first_deposit', 'deposit')),
    updated_at           = now()
  where s.id = target_submission;

  return coalesce(new, old);
end;
$$;

-- --- conversions → recalc earnings_cpa on submission ------------------------
create or replace function public.update_submission_earnings_cpa()
returns trigger
language plpgsql
as $$
declare
  target_submission uuid;
begin
  target_submission := coalesce(new.submission_id, old.submission_id);

  update public.submissions s
  set
    earnings_cpa = (select coalesce(sum(c.amount), 0)
                    from public.conversions c
                    where c.submission_id = target_submission
                      and c.status = 'approved'),
    updated_at   = now()
  where s.id = target_submission;

  return coalesce(new, old);
end;
$$;

-- --- submissions → recalc profile aggregates --------------------------------
create or replace function public.update_profile_aggregates()
returns trigger
language plpgsql
as $$
declare
  target_creator uuid;
  target_advertiser uuid;
begin
  target_creator := coalesce(new.creator_id, old.creator_id);

  -- creator-side aggregates
  update public.profiles p
  set
    total_views          = stats.total_views,
    total_clicks         = stats.total_clicks,
    total_registrations  = stats.total_registrations,
    total_first_deposits = stats.total_first_deposits,
    total_deposits_sum   = stats.total_deposits_sum,
    total_earned         = stats.total_earned,
    avg_cpm_earned       = case when stats.total_views > 0
                                then round((stats.total_earned * 1000.0) / stats.total_views, 4)
                                else 0 end,
    best_epc             = coalesce(stats.best_epc, 0),
    updated_at           = now()
  from (
    select
      coalesce(sum(s.views), 0)                    as total_views,
      coalesce(sum(s.clicks), 0)                   as total_clicks,
      coalesce(sum(s.registrations), 0)            as total_registrations,
      coalesce(sum(s.first_deposits), 0)           as total_first_deposits,
      coalesce(sum(s.total_deposits_sum), 0)       as total_deposits_sum,
      coalesce(sum(case when s.status in ('approved','paid')
                        then s.earnings_cpm + s.earnings_cpa else 0 end), 0) as total_earned,
      max(case when s.clicks > 0
               then (s.earnings_cpm + s.earnings_cpa) / s.clicks
               else 0 end)                         as best_epc
    from public.submissions s
    where s.creator_id = target_creator
  ) as stats
  where p.id = target_creator;

  -- advertiser-side total_spent (mirror of creators' earnings on their offers)
  select o.advertiser_id into target_advertiser
  from public.offers o
  where o.id = coalesce(new.offer_id, old.offer_id);

  if target_advertiser is not null then
    update public.profiles p
    set
      total_spent = (
        select coalesce(sum(s.earnings_cpm + s.earnings_cpa), 0)
        from public.submissions s
        join public.offers o on o.id = s.offer_id
        where o.advertiser_id = target_advertiser
          and s.status in ('approved','paid')
      ),
      updated_at = now()
    where p.id = target_advertiser;
  end if;

  return coalesce(new, old);
end;
$$;

-- --- submissions → recalc offer aggregates ----------------------------------
create or replace function public.update_offer_aggregates()
returns trigger
language plpgsql
as $$
declare
  target_offer uuid;
begin
  target_offer := coalesce(new.offer_id, old.offer_id);

  update public.offers o
  set
    total_views          = coalesce((select sum(s.views)          from public.submissions s where s.offer_id = target_offer), 0),
    total_submissions    = coalesce((select count(*)              from public.submissions s where s.offer_id = target_offer), 0),
    total_clicks         = coalesce((select sum(s.clicks)         from public.submissions s where s.offer_id = target_offer), 0),
    total_registrations  = coalesce((select sum(s.registrations)  from public.submissions s where s.offer_id = target_offer), 0),
    updated_at           = now()
  where o.id = target_offer;

  return coalesce(new, old);
end;
$$;


-- =============================================================================
-- 5. TRIGGERS
-- =============================================================================

-- --- auth.users → profiles --------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- --- updated_at touchers ----------------------------------------------------
create trigger trg_profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

create trigger trg_offers_touch_updated_at
  before update on public.offers
  for each row execute function public.touch_updated_at();

create trigger trg_submissions_touch_updated_at
  before update on public.submissions
  for each row execute function public.touch_updated_at();

-- --- submissions: recalc earnings_cpm on views/offer_id change --------------
create trigger trg_submissions_calc_earnings_cpm
  before insert or update of views, offer_id on public.submissions
  for each row execute function public.submissions_calc_earnings_cpm();

-- --- submission_events → submissions ---------------------------------------
create trigger trg_submission_events_update_metrics
  after insert or update or delete on public.submission_events
  for each row execute function public.update_submission_metrics();

-- --- conversions → submissions.earnings_cpa --------------------------------
create trigger trg_conversions_update_earnings
  after insert or update or delete on public.conversions
  for each row execute function public.update_submission_earnings_cpa();

-- --- submissions → profiles + offers aggregates ----------------------------
create trigger trg_submissions_update_profile
  after insert or update or delete on public.submissions
  for each row execute function public.update_profile_aggregates();

create trigger trg_submissions_update_offer
  after insert or update or delete on public.submissions
  for each row execute function public.update_offer_aggregates();


-- =============================================================================
-- 6. RLS POLICIES + column privileges + public views
-- =============================================================================

alter table public.profiles          enable row level security;
alter table public.social_accounts   enable row level security;
alter table public.offers            enable row level security;
alter table public.submissions       enable row level security;
alter table public.submission_events enable row level security;
alter table public.conversions       enable row level security;
alter table public.transactions      enable row level security;
alter table public.levels_config     enable row level security;
alter table public.achievements      enable row level security;
alter table public.user_achievements enable row level security;

-- --- profiles ---------------------------------------------------------------
-- Owner-only SELECT on the table itself. Public reads go through public_profiles view.
create policy profiles_select_own
  on public.profiles for select to authenticated
  using (auth.uid() = id);

create policy profiles_update_own
  on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Admins can see everything
create policy profiles_admin_all
  on public.profiles for all to authenticated
  using (exists (select 1 from public.profiles p
                 where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p
                      where p.id = auth.uid() and p.role = 'admin'));

-- Public profile view (runs as owner → bypasses RLS; exposes only safe cols)
create or replace view public.public_profiles
  with (security_invoker = false) as
select
  id, role, nickname, avatar_url, bio,
  xp, level,
  total_views, total_clicks, total_registrations, total_first_deposits,
  total_deposits_sum, total_earned, avg_cpm_earned, best_epc,
  leaderboard_visible, created_at
from public.profiles
where banned = false;

grant select on public.public_profiles to authenticated, anon;

-- --- social_accounts: owner-only -------------------------------------------
create policy social_accounts_owner_select
  on public.social_accounts for select to authenticated
  using (auth.uid() = user_id);

create policy social_accounts_owner_insert
  on public.social_accounts for insert to authenticated
  with check (auth.uid() = user_id);

create policy social_accounts_owner_update
  on public.social_accounts for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy social_accounts_owner_delete
  on public.social_accounts for delete to authenticated
  using (auth.uid() = user_id);

-- --- offers ----------------------------------------------------------------
-- Anyone authenticated can see active offers; advertiser can see all own offers.
create policy offers_select_active_or_own
  on public.offers for select to authenticated
  using (status = 'active' or advertiser_id = auth.uid());

-- Anon (landing, marketing) can see active offers
create policy offers_select_active_anon
  on public.offers for select to anon
  using (status = 'active');

create policy offers_insert_own
  on public.offers for insert to authenticated
  with check (advertiser_id = auth.uid());

create policy offers_update_own
  on public.offers for update to authenticated
  using (advertiser_id = auth.uid())
  with check (advertiser_id = auth.uid());

create policy offers_delete_own
  on public.offers for delete to authenticated
  using (advertiser_id = auth.uid());

-- --- submissions: creator OR offer advertiser ------------------------------
create policy submissions_select_participant
  on public.submissions for select to authenticated
  using (
    creator_id = auth.uid()
    or exists (select 1 from public.offers o
               where o.id = submissions.offer_id and o.advertiser_id = auth.uid())
  );

create policy submissions_insert_as_creator
  on public.submissions for insert to authenticated
  with check (creator_id = auth.uid());

-- Creator can edit own submission; advertiser can update status/rejection_reason
-- via separate admin path (enforced in app layer for now).
create policy submissions_update_creator
  on public.submissions for update to authenticated
  using (creator_id = auth.uid())
  with check (creator_id = auth.uid());

create policy submissions_update_advertiser
  on public.submissions for update to authenticated
  using (exists (select 1 from public.offers o
                 where o.id = submissions.offer_id and o.advertiser_id = auth.uid()))
  with check (exists (select 1 from public.offers o
                      where o.id = submissions.offer_id and o.advertiser_id = auth.uid()));

-- --- submission_events: same visibility as parent submission ---------------
create policy submission_events_select_participant
  on public.submission_events for select to authenticated
  using (
    exists (select 1 from public.submissions s
            where s.id = submission_events.submission_id
              and (s.creator_id = auth.uid()
                   or exists (select 1 from public.offers o
                              where o.id = s.offer_id and o.advertiser_id = auth.uid())))
  );

-- Inserts from the server-side postback handler come via service_role (bypasses RLS).
-- No INSERT/UPDATE/DELETE policy for end users.

-- --- conversions: same visibility as parent submission ---------------------
create policy conversions_select_participant
  on public.conversions for select to authenticated
  using (
    exists (select 1 from public.submissions s
            where s.id = conversions.submission_id
              and (s.creator_id = auth.uid()
                   or exists (select 1 from public.offers o
                              where o.id = s.offer_id and o.advertiser_id = auth.uid())))
  );

-- --- transactions: owner-only ----------------------------------------------
create policy transactions_select_own
  on public.transactions for select to authenticated
  using (user_id = auth.uid());

-- Writes only via service_role (withdrawal requests etc. go through server).

-- --- levels_config: public read --------------------------------------------
create policy levels_config_read_all
  on public.levels_config for select to authenticated, anon
  using (true);

-- --- achievements: public read ---------------------------------------------
create policy achievements_read_all
  on public.achievements for select to authenticated, anon
  using (true);

-- --- user_achievements: owner-only on base table --------------------------
-- Public витрина идёт через view public_user_achievements (см. ниже).
create policy user_achievements_select_own
  on public.user_achievements for select to authenticated
  using (user_id = auth.uid());

-- Public view: only (user_id, achievement_id) visible across users
create or replace view public.public_user_achievements
  with (security_invoker = false) as
select user_id, achievement_id
from public.user_achievements;

grant select on public.public_user_achievements to authenticated, anon;


-- =============================================================================
-- 7. MATERIALIZED VIEWS (leaderboards)
-- =============================================================================

-- refresh later with `refresh materialized view concurrently leaderboard_x;`

create materialized view public.leaderboard_creators_global as
select
  id, nickname, avatar_url, level, xp,
  total_views, total_earned, avg_cpm_earned
from public.profiles
where role = 'creator'
  and leaderboard_visible = true
  and banned = false
  and total_views > 0
order by total_views desc;

create unique index idx_lb_creators_global_id
  on public.leaderboard_creators_global(id);

create materialized view public.leaderboard_creators_premium as
select
  id, nickname, avatar_url, level, xp,
  total_views, total_earned, avg_cpm_earned
from public.profiles
where role = 'creator'
  and leaderboard_visible = true
  and banned = false
  and total_views > 10000
order by avg_cpm_earned desc;

create unique index idx_lb_creators_premium_id
  on public.leaderboard_creators_premium(id);

create materialized view public.leaderboard_advertisers as
select
  id, nickname, avatar_url, company_name, level, total_spent
from public.profiles
where role = 'advertiser'
  and leaderboard_visible = true
  and banned = false
  and total_spent > 0
order by total_spent desc;

create unique index idx_lb_advertisers_id
  on public.leaderboard_advertisers(id);

create materialized view public.leaderboard_offers_top as
select
  o.id,
  o.title,
  o.vertical,
  o.verticality_tier,
  o.cpm_rate,
  o.cpa_rate,
  o.total_views,
  o.total_submissions,
  p.nickname   as advertiser_nickname,
  p.avatar_url as advertiser_avatar
from public.offers o
join public.profiles p on p.id = o.advertiser_id
where o.status = 'active'
order by o.total_views desc;

create unique index idx_lb_offers_top_id
  on public.leaderboard_offers_top(id);

-- Materialized views don't honor RLS — use GRANT to control access.
grant select on public.leaderboard_creators_global  to authenticated, anon;
grant select on public.leaderboard_creators_premium to authenticated, anon;
grant select on public.leaderboard_advertisers      to authenticated, anon;
grant select on public.leaderboard_offers_top       to authenticated, anon;


-- =============================================================================
-- 8. SEED DATA (levels_config)
-- =============================================================================

insert into public.levels_config (role, level, title, min_xp) values
  ('creator',  1,  'Новичок',     0),
  ('creator',  2,  'Стартер',     10000),
  ('creator',  3,  'Серфер',      50000),
  ('creator',  4,  'Разгонщик',   200000),
  ('creator',  5,  'Про',         500000),
  ('creator',  6,  'Мастер',      1500000),
  ('creator',  7,  'Топ',         5000000),
  ('creator',  8,  'Легенда',     15000000),
  ('creator',  9,  'Голиаф',      50000000),
  ('creator', 10,  'UBT King',    150000000);

-- For advertisers, min_xp holds the USDT total_spent threshold.
insert into public.levels_config (role, level, title, min_xp) values
  ('advertiser',  1,  'Новичок',       0),
  ('advertiser',  2,  'Стартер',       500),
  ('advertiser',  3,  'Партнёр',       2000),
  ('advertiser',  4,  'Брокер',        10000),
  ('advertiser',  5,  'Инвестор',      50000),
  ('advertiser',  6,  'Ментор',        150000),
  ('advertiser',  7,  'Мажор',         500000),
  ('advertiser',  8,  'Магнат',        1500000),
  ('advertiser',  9,  'Империя',       5000000),
  ('advertiser', 10,  'UBT Kingmaker', 15000000);
