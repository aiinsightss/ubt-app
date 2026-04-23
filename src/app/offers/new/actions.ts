"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

const VALID_VERTICALS = [
  "gambling", "betting", "games", "saas", "crypto", "finance",
  "dating", "nutra", "education", "ecommerce", "other",
] as const;

const VALID_TIERS = ["white", "grey", "black"] as const;

export interface TierData {
  tier_level: number;
  min_views_threshold: number;
  cpm_rate: number;
  cpa_rate: number;
}

export interface OfferFormData {
  title: string;
  description: string;
  vertical: string;
  verticality_tier: string;
  payout_type: "cpm" | "cpa";
  payout_mode: "flat" | "tiered";
  // flat only
  cpm_rate: number;
  cpa_rate: number;
  // tiered only
  tiers: TierData[];
  // cpa only
  cpa_link_template: string;
  // common
  budget_total: number;
  geo: string[];
  rules: string;
}

type CreateOfferResult =
  | { success: true; offerId: string }
  | { error: string };

export async function createOffer(
  data: OfferFormData,
): Promise<CreateOfferResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Не авторизован" };

  if (user.user_metadata?.role !== "advertiser") {
    return { error: "Только рекламодатели могут создавать офферы" };
  }

  // ── Server-side validation ──────────────────────────────────────────────────

  const title = data.title?.trim() ?? "";
  if (title.length < 3 || title.length > 100) {
    return { error: "Название: от 3 до 100 символов" };
  }

  const description = data.description?.trim() ?? "";
  if (description.length > 500) {
    return { error: "Описание: максимум 500 символов" };
  }

  if (data.payout_type !== "cpm" && data.payout_type !== "cpa") {
    return { error: "Неверный тип выплаты" };
  }

  if (data.payout_mode !== "flat" && data.payout_mode !== "tiered") {
    return { error: "Неверный режим выплаты" };
  }

  if (data.payout_mode === "flat") {
    if (data.payout_type === "cpm") {
      if (
        !Number.isFinite(data.cpm_rate) ||
        data.cpm_rate < 0.1 ||
        data.cpm_rate > 100
      ) {
        return { error: "CPM ставка: от 0.1 до 100 USDT" };
      }
    } else {
      if (
        !Number.isFinite(data.cpa_rate) ||
        data.cpa_rate < 1 ||
        data.cpa_rate > 10000
      ) {
        return { error: "CPA ставка: от 1 до 10 000 USDT" };
      }
    }
  } else {
    // tiered
    const tiers = data.tiers ?? [];
    if (tiers.length < 1 || tiers.length > 10) {
      return { error: "Количество тиров: от 1 до 10" };
    }
    for (let i = 0; i < tiers.length; i++) {
      const t = tiers[i];
      if (t.tier_level !== i + 1) {
        return { error: `Тир ${i + 1}: неверный номер тира` };
      }
      if (!Number.isFinite(t.min_views_threshold) || t.min_views_threshold < 0) {
        return { error: `Тир ${i + 1}: порог просмотров должен быть ≥ 0` };
      }
      if (i > 0 && t.min_views_threshold <= tiers[i - 1].min_views_threshold) {
        return { error: `Тир ${i + 1}: порог должен быть больше предыдущего` };
      }
      if (data.payout_type === "cpm") {
        if (!Number.isFinite(t.cpm_rate) || t.cpm_rate <= 0) {
          return { error: `Тир ${i + 1}: CPM ставка должна быть > 0` };
        }
      } else {
        if (!Number.isFinite(t.cpa_rate) || t.cpa_rate <= 0) {
          return { error: `Тир ${i + 1}: CPA ставка должна быть > 0` };
        }
      }
    }
  }

  if (data.payout_type === "cpa") {
    if (!data.cpa_link_template?.includes("{subid}")) {
      return { error: "Ссылка должна содержать {subid}" };
    }
    try {
      new URL(data.cpa_link_template);
    } catch {
      return { error: "Некорректный URL партнёрской ссылки" };
    }
  }

  if (
    !VALID_VERTICALS.includes(
      data.vertical as (typeof VALID_VERTICALS)[number],
    )
  ) {
    return { error: "Неверная вертикаль" };
  }

  if (
    !VALID_TIERS.includes(
      data.verticality_tier as (typeof VALID_TIERS)[number],
    )
  ) {
    return { error: "Неверный тип вертикали" };
  }

  if (!Number.isFinite(data.budget_total) || data.budget_total < 50) {
    return { error: "Бюджет: минимум 50 USDT" };
  }

  const geo = (data.geo ?? [])
    .filter(Boolean)
    .map((g) => g.toUpperCase().trim());
  for (const code of geo) {
    if (code.length > 5) return { error: `Неверный гео-код: ${code}` };
  }

  const rules = data.rules?.trim() ?? "";
  if (rules.length > 2000) {
    return { error: "Правила: максимум 2000 символов" };
  }

  // ── Transactional insert via RPC ───────────────────────────────────────────

  const offerPayload = {
    title,
    description,
    vertical: data.vertical,
    verticality_tier: data.verticality_tier,
    payout_type: data.payout_type,
    payout_mode: data.payout_mode,
    cpm_rate:
      data.payout_mode === "flat" && data.payout_type === "cpm"
        ? data.cpm_rate
        : 0,
    cpa_rate:
      data.payout_mode === "flat" && data.payout_type === "cpa"
        ? data.cpa_rate
        : 0,
    cpa_link_template:
      data.payout_type === "cpa" ? data.cpa_link_template : "",
    budget_total: data.budget_total,
    geo,
    rules,
  };

  const tiersPayload =
    data.payout_mode === "tiered" ? (data.tiers ?? []) : [];

  const { data: offerId, error: rpcError } = await supabase.rpc(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    "create_offer_with_tiers" as any,
    {
      p_advertiser_id: user.id,
      p_offer: offerPayload,
      p_tiers: tiersPayload,
    },
  );

  if (rpcError || !offerId) {
    console.error(
      "[offers/new/actions] createOffer RPC failed",
      JSON.stringify(rpcError),
    );
    return { error: "Не удалось создать оффер. Попробуй ещё раз." };
  }

  revalidatePath("/dashboard");
  return { success: true, offerId: offerId as string };
}
