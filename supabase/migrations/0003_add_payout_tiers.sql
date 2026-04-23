-- =============================================================================
-- UBT Marketplace — 0003: payout tiers
-- Sections:
--   1. New enum + column additions
--   2. offer_payout_tiers table + indexes + RLS
--   3. Updated submissions_calc_earnings_cpm (tiered retroactive logic)
--   4. RPC: create_offer_with_tiers (transactional offer + tiers insert)
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. New enum + column additions
-- =============================================================================

CREATE TYPE payout_mode AS ENUM ('flat', 'tiered');

-- Existing offers keep 'flat' — cpm_rate / cpa_rate continue to work unchanged.
ALTER TABLE public.offers
  ADD COLUMN payout_mode payout_mode NOT NULL DEFAULT 'flat';

-- Cache which tier a submission is currently in (NULL = flat offer).
ALTER TABLE public.submissions
  ADD COLUMN current_tier_level smallint;


-- =============================================================================
-- 2. offer_payout_tiers table + indexes + RLS
-- =============================================================================

CREATE TABLE public.offer_payout_tiers (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id            uuid          NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  tier_level          smallint      NOT NULL CHECK (tier_level BETWEEN 1 AND 10),
  min_views_threshold bigint        NOT NULL DEFAULT 0 CHECK (min_views_threshold >= 0),
  cpm_rate            numeric(10,4) NOT NULL DEFAULT 0 CHECK (cpm_rate >= 0),
  cpa_rate            numeric(10,2) NOT NULL DEFAULT 0 CHECK (cpa_rate >= 0),
  created_at          timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (offer_id, tier_level)
);

CREATE INDEX idx_payout_tiers_offer
  ON public.offer_payout_tiers(offer_id, tier_level);

ALTER TABLE public.offer_payout_tiers ENABLE ROW LEVEL SECURITY;

-- Authenticated users see tiers of active offers; advertisers see their own.
CREATE POLICY offer_payout_tiers_select_visible
  ON public.offer_payout_tiers FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.offers o
      WHERE o.id = offer_payout_tiers.offer_id
        AND (o.status = 'active' OR o.advertiser_id = auth.uid())
    )
  );

CREATE POLICY offer_payout_tiers_insert_owner
  ON public.offer_payout_tiers FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.offers o
      WHERE o.id = offer_payout_tiers.offer_id
        AND o.advertiser_id = auth.uid()
    )
  );

CREATE POLICY offer_payout_tiers_update_owner
  ON public.offer_payout_tiers FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.offers o
      WHERE o.id = offer_payout_tiers.offer_id
        AND o.advertiser_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.offers o
      WHERE o.id = offer_payout_tiers.offer_id
        AND o.advertiser_id = auth.uid()
    )
  );

CREATE POLICY offer_payout_tiers_delete_owner
  ON public.offer_payout_tiers FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.offers o
      WHERE o.id = offer_payout_tiers.offer_id
        AND o.advertiser_id = auth.uid()
    )
  );


-- =============================================================================
-- 3. Updated submissions_calc_earnings_cpm
-- Retroactive tiered billing: all views billed at the rate of the currently
-- active tier (whichever tier's min_views_threshold <= NEW.views is highest).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.submissions_calc_earnings_cpm()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_payout_mode   payout_mode;
  v_flat_cpm_rate numeric(10,4);
  v_tier_cpm_rate numeric(10,4);
  v_tier_level    smallint;
BEGIN
  SELECT o.payout_mode, o.cpm_rate
  INTO   v_payout_mode, v_flat_cpm_rate
  FROM   public.offers o
  WHERE  o.id = NEW.offer_id;

  IF v_payout_mode IS NULL OR v_payout_mode = 'flat' THEN
    NEW.earnings_cpm       := round((NEW.views * COALESCE(v_flat_cpm_rate, 0)) / 1000.0, 2);
    NEW.current_tier_level := NULL;

  ELSE  -- tiered: find the highest threshold that is <= current views
    SELECT t.cpm_rate, t.tier_level
    INTO   v_tier_cpm_rate, v_tier_level
    FROM   public.offer_payout_tiers t
    WHERE  t.offer_id = NEW.offer_id
      AND  t.min_views_threshold <= NEW.views
    ORDER BY t.min_views_threshold DESC
    LIMIT 1;

    IF v_tier_cpm_rate IS NULL THEN
      -- views below the lowest tier's threshold
      NEW.earnings_cpm       := 0;
      NEW.current_tier_level := 0;
    ELSE
      NEW.earnings_cpm       := round((NEW.views * v_tier_cpm_rate) / 1000.0, 2);
      NEW.current_tier_level := v_tier_level;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


-- =============================================================================
-- 4. RPC: create_offer_with_tiers
-- Wraps offers INSERT + offer_payout_tiers INSERT in one transaction.
-- Pass p_tiers = '[]'::jsonb for flat-mode offers.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_offer_with_tiers(
  p_advertiser_id uuid,
  p_offer         jsonb,
  p_tiers         jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  new_offer_id uuid;
  tier_record  jsonb;
BEGIN
  -- Caller must own the advertiser_id they pass in.
  IF p_advertiser_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Forbidden: advertiser_id must match authenticated user';
  END IF;

  INSERT INTO public.offers (
    advertiser_id,
    title,
    description,
    vertical,
    verticality_tier,
    payout_type,
    payout_mode,
    cpm_rate,
    cpa_rate,
    cpa_link_template,
    budget_total,
    geo,
    rules,
    status
  ) VALUES (
    p_advertiser_id,
    p_offer->>'title',
    NULLIF(p_offer->>'description', ''),
    p_offer->>'vertical',
    (p_offer->>'verticality_tier')::verticality_tier,
    (p_offer->>'payout_type')::payout_type,
    (p_offer->>'payout_mode')::payout_mode,
    COALESCE((p_offer->>'cpm_rate')::numeric, 0),
    COALESCE((p_offer->>'cpa_rate')::numeric, 0),
    NULLIF(p_offer->>'cpa_link_template', ''),
    (p_offer->>'budget_total')::numeric,
    ARRAY(SELECT jsonb_array_elements_text(p_offer->'geo')),
    NULLIF(p_offer->>'rules', ''),
    'active'
  )
  RETURNING id INTO new_offer_id;

  IF jsonb_array_length(p_tiers) > 0 THEN
    FOR tier_record IN SELECT * FROM jsonb_array_elements(p_tiers) LOOP
      INSERT INTO public.offer_payout_tiers (
        offer_id,
        tier_level,
        min_views_threshold,
        cpm_rate,
        cpa_rate
      ) VALUES (
        new_offer_id,
        (tier_record->>'tier_level')::smallint,
        (tier_record->>'min_views_threshold')::bigint,
        COALESCE((tier_record->>'cpm_rate')::numeric, 0),
        COALESCE((tier_record->>'cpa_rate')::numeric, 0)
      );
    END LOOP;
  END IF;

  RETURN new_offer_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_offer_with_tiers(uuid, jsonb, jsonb) TO authenticated;

COMMIT;
