import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, LayoutDashboard } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import type { Offer } from "@/types/database";

export default async function OfferDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
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

  const { id } = await params;

  // RLS (offers_select_active_or_own) enforces visibility:
  //   - creators see only active offers,
  //   - advertisers also see their own non-active offers.
  const { data: offer } = await supabase
    .from("offers")
    .select("id, title, description, advertiser_id")
    .eq("id", id)
    .maybeSingle<Pick<Offer, "id" | "title" | "description" | "advertiser_id">>();

  if (!offer) notFound();

  const { data: advertiser } = await supabase
    .from("public_profiles")
    .select("nickname")
    .eq("id", offer.advertiser_id)
    .maybeSingle<{ nickname: string }>();

  const role = profile.role as string;
  const backHref = role === "creator" ? "/offers" : "/dashboard";
  const backLabel =
    role === "creator" ? "Назад к каталогу" : "К дашборду";
  const BackIcon = role === "creator" ? ArrowLeft : LayoutDashboard;

  return (
    <main className="min-h-screen bg-background px-4 py-10 sm:py-12">
      <div className="mx-auto w-full max-w-2xl space-y-8">
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href={backHref} />}
        >
          <BackIcon />
          {backLabel}
        </Button>

        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {offer.title}
          </h1>
          {advertiser?.nickname && (
            <p className="text-sm text-muted-foreground">
              от {advertiser.nickname}
            </p>
          )}
          {offer.description && (
            <p className="pt-2 text-base text-muted-foreground">
              {offer.description}
            </p>
          )}
        </header>

        <section className="rounded-2xl border border-slate-800 bg-card/50 px-6 py-10 text-center">
          <h2 className="text-lg font-semibold text-foreground">
            Детальная страница оффера — скоро
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Здесь появятся условия участия, ставки по тирам, гео и форма подачи
            ролика.
          </p>
        </section>
      </div>
    </main>
  );
}
