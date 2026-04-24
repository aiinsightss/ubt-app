import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type {
  Offer,
  OfferPayoutTier,
  PublicProfile,
  UserRole,
} from "@/types/database";

import { OffersCatalog, type OfferCatalogItem } from "./offers-catalog";

export default async function OffersPage({
  searchParams,
}: {
  searchParams: Promise<{ vertical?: string }>;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile?.role) redirect("/onboarding");
  if ((profile.role as UserRole) !== "creator") {
    redirect("/dashboard?error=creator_only");
  }

  const { vertical } = await searchParams;
  const verticalFilter = vertical?.trim() || null;

  let offersQuery = supabase
    .from("offers")
    .select("*, offer_payout_tiers(*)")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (verticalFilter) {
    offersQuery = offersQuery.eq("vertical", verticalFilter);
  }

  const { data: offersRaw } = await offersQuery;
  const offers = (offersRaw ?? []) as (Offer & {
    offer_payout_tiers: OfferPayoutTier[];
  })[];

  const advertiserIds = Array.from(
    new Set(offers.map((o) => o.advertiser_id)),
  );

  let profileMap = new Map<
    string,
    Pick<PublicProfile, "id" | "nickname" | "avatar_url">
  >();

  if (advertiserIds.length > 0) {
    const { data: profilesRaw } = await supabase
      .from("public_profiles")
      .select("id, nickname, avatar_url")
      .in("id", advertiserIds);

    profileMap = new Map(
      (profilesRaw ?? []).map((p) => [
        p.id as string,
        p as Pick<PublicProfile, "id" | "nickname" | "avatar_url">,
      ]),
    );
  }

  const items: OfferCatalogItem[] = offers.map((o) => ({
    ...o,
    advertiser: profileMap.get(o.advertiser_id) ?? null,
  }));

  return <OffersCatalog offers={items} currentVertical={verticalFilter} />;
}
