import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { OfferForm } from "./offer-form";

export default async function NewOfferPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  if (user.user_metadata?.role !== "advertiser") redirect("/dashboard");

  const { data: profile } = await supabase
    .from("public_profiles")
    .select("role, nickname")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/dashboard");

  return <OfferForm profile={profile} />;
}
