import { redirect } from "next/navigation";
import { Calendar, Mail, Megaphone, Trophy, Wallet } from "lucide-react";

import { LogoutButton } from "@/components/logout-button";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    user.email ??
    "пользователь";
  const avatarUrl =
    (user.user_metadata?.avatar_url as string | undefined) ??
    (user.user_metadata?.picture as string | undefined);
  const provider = user.app_metadata?.provider ?? "email";
  const createdAt = new Date(user.created_at).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <main className="min-h-screen flex flex-col items-center bg-background px-4 py-12 sm:py-16">
      <div className="max-w-2xl w-full space-y-10">
        {/* Beta badge */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-sm font-medium">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            Ранний доступ
          </div>
        </div>

        {/* Avatar + greeting */}
        <div className="text-center space-y-5">
          {avatarUrl ? (
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatarUrl}
                alt={displayName}
                referrerPolicy="no-referrer"
                className="h-20 w-20 rounded-full ring-2 ring-primary/40 ring-offset-4 ring-offset-background"
              />
            </div>
          ) : null}
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground leading-tight">
            Привет, <span className="text-primary">{displayName}</span>!
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-md mx-auto leading-relaxed">
            Добро пожаловать в UBT. Скоро здесь появятся офферы, рейтинг и
            выплаты.
          </p>
        </div>

        {/* User info */}
        <div className="rounded-2xl border border-border bg-card/50 p-5 sm:p-6 space-y-3">
          <InfoRow
            icon={<Mail className="h-4 w-4" />}
            label="Email"
            value={user.email ?? "—"}
          />
          <InfoRow
            icon={<Calendar className="h-4 w-4" />}
            label="Регистрация"
            value={createdAt}
          />
          <InfoRow
            icon={
              <span className="h-4 w-4 flex items-center justify-center">
                <span className="h-2 w-2 rounded-full bg-primary" />
              </span>
            }
            label="Провайдер"
            value={<span className="capitalize">{provider}</span>}
          />
        </div>

        {/* Feature stubs */}
        <div className="space-y-3">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground/70 font-semibold px-1">
            Скоро будет доступно
          </h2>
          <div className="grid sm:grid-cols-3 gap-3">
            <FeatureStub
              icon={<Megaphone className="h-5 w-5" />}
              title="Офферы"
              description="Каталог офферов от рекламодателей"
            />
            <FeatureStub
              icon={<Trophy className="h-5 w-5" />}
              title="Мой уровень"
              description="Рейтинг и XP за просмотры"
            />
            <FeatureStub
              icon={<Wallet className="h-5 w-5" />}
              title="Выплаты"
              description="Баланс и история вывода в USDT"
            />
          </div>
        </div>

        {/* Logout */}
        <div className="flex justify-center pt-2">
          <LogoutButton />
        </div>
      </div>
    </main>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 text-sm min-w-0">
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <span className="text-muted-foreground shrink-0">{label}:</span>
      <span className="text-foreground font-medium truncate">{value}</span>
    </div>
  );
}

function FeatureStub({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="relative rounded-xl border border-border bg-muted/20 p-4 opacity-60">
      <div className="absolute top-2 right-2 text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold px-1.5 py-0.5 rounded bg-muted/50">
        Скоро
      </div>
      <div className="text-muted-foreground mb-2">{icon}</div>
      <h3 className="font-semibold text-foreground mb-1 text-sm">{title}</h3>
      <p className="text-xs text-muted-foreground/80 leading-snug">
        {description}
      </p>
    </div>
  );
}
