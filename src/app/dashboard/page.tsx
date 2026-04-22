import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Settings } from "lucide-react";

import { LogoutButton } from "@/components/logout-button";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";

const numberFormat = new Intl.NumberFormat("ru-RU");
const compactFormat = new Intl.NumberFormat("ru-RU", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatUsdt(raw: string | number | null | undefined): string {
  const n =
    typeof raw === "number" ? raw : raw ? Number.parseFloat(raw) : 0;
  if (!Number.isFinite(n)) return "0 USDT";
  return `${numberFormat.format(Math.round(n * 100) / 100)} USDT`;
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "role, nickname, avatar_url, xp, level, total_views, total_earned, total_spent",
    )
    .eq("id", user.id)
    .single();

  if (!profile?.role) {
    redirect("/onboarding");
  }

  const role = profile.role as UserRole;
  const nickname = profile.nickname ?? "друг";
  const avatarUrl = profile.avatar_url ?? null;
  const xp = profile.xp ?? 0;
  const level = profile.level ?? 1;
  const totalViews = profile.total_views ?? 0;
  const totalEarned = profile.total_earned ?? "0";
  const totalSpent = profile.total_spent ?? "0";

  const isCreator = role === "creator";
  const isAdvertiser = role === "advertiser";

  // MVP placeholder: hardcoded level title + progress (levels_config read comes later).
  const levelTitle = isCreator ? "Новичок" : "Стартап";
  const xpIntoLevel = xp % 1000;
  const xpProgressPct = Math.min(100, Math.round((xpIntoLevel / 1000) * 100));

  return (
    <main className="min-h-screen bg-background px-4 py-10 sm:py-12">
      <div className="mx-auto w-full max-w-3xl space-y-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={nickname}
                referrerPolicy="no-referrer"
                className="h-12 w-12 rounded-full ring-2 ring-primary/40 ring-offset-2 ring-offset-background"
              />
            ) : (
              <div className="h-12 w-12 rounded-full bg-muted" />
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold text-foreground truncate">
                  {nickname}
                </span>
                <RoleBadge role={role} />
              </div>
              <p className="text-sm text-muted-foreground">
                Привет, {nickname}!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="lg"
              nativeButton={false}
              render={<Link href="/settings" />}
            >
              <Settings />
              Настройки
            </Button>
            <LogoutButton />
          </div>
        </header>

        <section className="space-y-4">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground/70 font-semibold">
            {isCreator ? "Твоя статистика" : "Твоя компания"}
          </h2>

          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Уровень"
              value={`${level} · ${levelTitle}`}
              footer={
                <div className="space-y-1">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${xpProgressPct}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {numberFormat.format(xpIntoLevel)} / 1 000 XP до следующего
                  </div>
                </div>
              }
            />

            {isCreator && (
              <>
                <StatCard
                  label="Просмотры"
                  value={compactFormat.format(totalViews)}
                />
                <StatCard
                  label="Заработано"
                  value={formatUsdt(totalEarned)}
                />
                <StatCard label="XP" value={numberFormat.format(xp)} />
              </>
            )}

            {isAdvertiser && (
              <>
                <StatCard label="Активных офферов" value="0" />
                <StatCard
                  label="Потрачено"
                  value={formatUsdt(totalSpent)}
                />
                <StatCard label="Баланс" value="0 USDT" />
              </>
            )}
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          {isCreator && (
            <>
              <Button
                size="lg"
                className="h-14 text-base"
                nativeButton={false}
                render={<Link href="/offers" />}
              >
                Найти офферы
                <ArrowRight />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-14 text-base"
                nativeButton={false}
                render={<Link href="/profile" />}
              >
                Мой профиль
                <ArrowRight />
              </Button>
            </>
          )}

          {isAdvertiser && (
            <>
              <Button
                size="lg"
                className="h-14 text-base"
                nativeButton={false}
                render={<Link href="/offers/new" />}
              >
                Создать оффер
                <ArrowRight />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-14 text-base"
                nativeButton={false}
                render={<Link href="/offers/mine" />}
              >
                Мои офферы
                <ArrowRight />
              </Button>
            </>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground/70 font-semibold">
            Скоро будет доступно
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(isCreator
              ? [
                  { title: "Офферы", description: "Каталог офферов от рекламодателей" },
                  { title: "Мой уровень", description: "Рейтинг и XP за просмотры" },
                  { title: "Выплаты", description: "Баланс и история вывода в USDT" },
                  { title: "Рейтинг", description: "Топ креативщиков по заработку" },
                ]
              : [
                  { title: "Каталог креативщиков", description: "Выбирай блогеров под свой оффер" },
                  { title: "Выплаты", description: "Пополнение баланса и история" },
                  { title: "Аналитика", description: "Конверсии, CPA, ROI по офферам" },
                  { title: "Модерация", description: "Проверка и одобрение роликов" },
                ]
            ).map((item) => (
              <FeatureStub key={item.title} {...item} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  if (role === "creator") {
    return (
      <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
        Креативщик
      </span>
    );
  }
  if (role === "advertiser") {
    return (
      <span className="inline-flex items-center rounded-full border border-indigo-400/30 bg-indigo-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-300">
        Рекламодатель
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      Админ
    </span>
  );
}

function StatCard({
  label,
  value,
  footer,
}: {
  label: string;
  value: string;
  footer?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/50 p-4 sm:p-5 space-y-2">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-xl sm:text-2xl font-black text-foreground tabular-nums">
        {value}
      </div>
      {footer}
    </div>
  );
}

function FeatureStub({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="relative rounded-xl border border-border bg-muted/20 p-4 opacity-60">
      <div className="absolute top-2 right-2 text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold px-1.5 py-0.5 rounded bg-muted/50">
        Скоро
      </div>
      <h3 className="font-semibold text-foreground mb-1 text-sm pr-14">
        {title}
      </h3>
      <p className="text-xs text-muted-foreground/80 leading-snug">
        {description}
      </p>
    </div>
  );
}
