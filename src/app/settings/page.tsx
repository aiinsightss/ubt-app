import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";

function roleLabel(role: UserRole): string {
  if (role === "creator") return "Креативщик";
  if (role === "advertiser") return "Рекламодатель";
  return "Админ";
}

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, nickname")
    .eq("id", user.id)
    .single();

  if (!profile?.role) {
    redirect("/onboarding");
  }

  const role = profile.role as UserRole;
  const nickname = profile.nickname ?? "—";
  const email = user.email ?? "—";

  return (
    <main className="min-h-screen bg-background px-4 py-10 sm:py-12">
      <div className="mx-auto w-full max-w-2xl space-y-8">
        <header className="space-y-1">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground">
            Настройки
          </h1>
          <p className="text-sm text-muted-foreground">
            Управление ролью и профилем
          </p>
        </header>

        <section className="rounded-2xl border border-border bg-card/50 p-5 sm:p-6 space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-foreground">Роль</h2>
            <p className="text-sm text-muted-foreground">
              Текущая роль:{" "}
              <span className="font-semibold text-foreground">
                {roleLabel(role)}
              </span>
            </p>
          </div>
          <Button variant="outline" size="lg" disabled>
            Сменить роль
          </Button>
          <p className="text-xs text-muted-foreground/80 leading-relaxed">
            Смена роли будет доступна в ближайших обновлениях. После смены старая
            статистика сохраняется. Менять роль можно раз в 30 дней.
          </p>
        </section>

        <section className="rounded-2xl border border-border bg-card/50 p-5 sm:p-6 space-y-4">
          <h2 className="text-lg font-bold text-foreground">Профиль</h2>
          <div className="space-y-3">
            <ReadonlyRow label="Ник" value={nickname} />
            <ReadonlyRow label="Email" value={email} />
          </div>
          <Button variant="outline" size="lg" disabled>
            Редактировать профиль
          </Button>
        </section>

        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowRight className="h-4 w-4 rotate-180" />
            Назад к дашборду
          </Link>
        </div>
      </div>
    </main>
  );
}

function ReadonlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="text-sm text-foreground font-medium truncate">
        {value}
      </span>
    </div>
  );
}
