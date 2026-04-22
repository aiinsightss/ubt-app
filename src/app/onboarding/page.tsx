import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { OnboardingFlow } from "./onboarding-flow";

export default async function OnboardingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("public_profiles")
    .select("role, nickname")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error(
      "[onboarding/page] read own profile via public_profiles failed",
      JSON.stringify(profileError),
    );
  }

  if (profile?.role) {
    redirect("/dashboard");
  }

  const defaultNickname =
    typeof profile?.nickname === "string" ? profile.nickname : "";

  return <OnboardingFlow defaultNickname={defaultNickname} />;
}
