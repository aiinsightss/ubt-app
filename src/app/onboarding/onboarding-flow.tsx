"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useMotionValue,
  useTransform,
} from "motion/react";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Megaphone,
  Video,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import type { UserRole } from "@/types/database";

import { checkNicknameAvailability, completeOnboarding } from "./actions";

type SelectableRole = Extract<UserRole, "creator" | "advertiser">;

type NicknameStatus =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "available" }
  | { kind: "invalid"; message: string };

const NICKNAME_REGEX = /^[a-zA-Z0-9_-]{3,20}$/;

export function OnboardingFlow({ defaultNickname }: { defaultNickname: string }) {
  const router = useRouter();
  const [role, setRole] = useState<SelectableRole | null>(null);
  const [nickname, setNickname] = useState(defaultNickname);
  const [status, setStatus] = useState<NicknameStatus>({ kind: "idle" });
  const [isSubmitting, startSubmit] = useTransition();

  const debouncedNickname = useDebouncedValue(nickname, 500);

  useEffect(() => {
    if (!role) return;

    if (!debouncedNickname) {
      setStatus({ kind: "idle" });
      return;
    }

    if (!NICKNAME_REGEX.test(debouncedNickname)) {
      setStatus({
        kind: "invalid",
        message: "Ник: 3-20 символов, латиница, цифры, _ или -",
      });
      return;
    }

    let cancelled = false;
    setStatus({ kind: "checking" });

    checkNicknameAvailability(debouncedNickname)
      .then((result) => {
        if (cancelled) return;
        if (result.available) {
          setStatus({ kind: "available" });
        } else {
          setStatus({ kind: "invalid", message: result.error });
        }
      })
      .catch(() => {
        if (cancelled) return;
        setStatus({
          kind: "invalid",
          message: "Не удалось проверить ник. Попробуй ещё раз.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedNickname, role]);

  const canSubmit =
    role !== null && status.kind === "available" && !isSubmitting;

  const handleSubmit = () => {
    if (!role || status.kind !== "available") return;

    startSubmit(async () => {
      const result = await completeOnboarding({ role, nickname });
      if ("success" in result && result.success) {
        toast.success("Добро пожаловать в UBT!");
        router.push("/dashboard");
        router.refresh();
      } else {
        toast.error(result.error ?? "Что-то пошло не так");
      }
    });
  };

  return (
    <main className="min-h-screen bg-background px-4 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-[1100px] space-y-8 sm:space-y-12">
        <div className="text-center space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-sm font-medium">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            Добро пожаловать
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-foreground">
            Кто ты в UBT?
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Выбери роль, с которой начнёшь. Позже можно будет поменять в
            настройках.
          </p>
        </div>

        <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
          <CreatorCard selected={role === "creator"} onSelect={() => setRole("creator")} />
          <AdvertiserCard
            selected={role === "advertiser"}
            onSelect={() => setRole("advertiser")}
          />
        </div>

        <AnimatePresence mode="wait">
          {role && (
            <motion.div
              key="nickname-step"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="mx-auto w-full max-w-md space-y-4"
            >
              <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight text-foreground text-center">
                  Как тебя называть?
                </h2>
                <p className="text-sm text-muted-foreground text-center">
                  Публичный ник. Виден в рейтинге и на профиле.
                </p>
              </div>

              <div className="space-y-2">
                <div className="relative">
                  <Input
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="nickname"
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    aria-invalid={status.kind === "invalid"}
                    className="pr-10"
                  />
                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                    {status.kind === "checking" && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    {status.kind === "available" && (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    )}
                    {status.kind === "invalid" && (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                  </div>
                </div>
                <div className="min-h-5 text-sm">
                  {status.kind === "available" && (
                    <span className="text-primary">Доступно</span>
                  )}
                  {status.kind === "invalid" && (
                    <span className="text-destructive">{status.message}</span>
                  )}
                </div>
              </div>

              <Button
                size="lg"
                className="w-full text-base"
                disabled={!canSubmit}
                onClick={handleSubmit}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Сохраняем...
                  </>
                ) : (
                  <>
                    Начать
                    <ArrowRight />
                  </>
                )}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

type CardProps = {
  selected: boolean;
  onSelect: () => void;
};

function CreatorCard({ selected, onSelect }: CardProps) {
  return (
    <RoleCard
      selected={selected}
      onSelect={onSelect}
      icon={<Video className="h-6 w-6 text-primary" />}
      title="Креативщик"
      description="Бери офферы в работу и зарабатывай на своих роликах"
      bullets={[
        "Готовые офферы от брендов",
        "Оплата по CPM или CPA",
        "Выплаты в USDT",
      ]}
      visual={<CreatorVisual />}
    />
  );
}

function AdvertiserCard({ selected, onSelect }: CardProps) {
  return (
    <RoleCard
      selected={selected}
      onSelect={onSelect}
      icon={<Megaphone className="h-6 w-6 text-primary" />}
      title="Рекламодатель"
      description="Размещай офферы и получай органический трафик"
      bullets={[
        "Создание офферов за минуты",
        "Фиксированная ставка или CPA",
        "Только качественный трафик",
      ]}
      visual={<AdvertiserVisual />}
    />
  );
}

function RoleCard({
  selected,
  onSelect,
  icon,
  title,
  description,
  bullets,
  visual,
}: CardProps & {
  icon: React.ReactNode;
  title: string;
  description: string;
  bullets: string[];
  visual: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      aria-pressed={selected}
      className={[
        "group relative w-full overflow-hidden rounded-2xl border p-6 sm:p-7 text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/40",
        selected
          ? "border-primary bg-primary/5"
          : "border-slate-800 bg-card/30 hover:border-slate-700",
      ].join(" ")}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/20">
          {icon}
        </div>
        <div className="min-w-0 space-y-1.5">
          <h3 className="text-xl font-bold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground leading-snug">
            {description}
          </p>
        </div>
      </div>

      <ul className="mt-5 space-y-2">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2 text-sm text-foreground/90">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>{b}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6">{visual}</div>

      <div
        className={[
          "pointer-events-none absolute top-3 right-3 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition-opacity",
          selected
            ? "border-primary/60 bg-primary/20 text-primary opacity-100"
            : "opacity-0",
        ].join(" ")}
      >
        Выбрано
      </div>
    </motion.button>
  );
}

function CreatorVisual() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });

  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.round(v));
  const formatted = useTransform(rounded, (v) =>
    new Intl.NumberFormat("ru-RU").format(v),
  );
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    const unsub = formatted.on("change", (v) => setDisplay(v));
    return () => unsub();
  }, [formatted]);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(count, 12847, {
      duration: 2.5,
      ease: [0.16, 1, 0.3, 1],
    });
    return () => controls.stop();
  }, [inView, count]);

  return (
    <div
      ref={ref}
      className="rounded-xl border border-border/60 bg-background/60 p-4"
    >
      <div className="flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          Просмотры
        </span>
        <span className="font-mono text-2xl font-black text-foreground tabular-nums">
          {display}
        </span>
      </div>
      <motion.div
        className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary"
        animate={{ opacity: [0.6, 1, 0.6], scale: [1, 1.04, 1] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      >
        +42 USDT
      </motion.div>
    </div>
  );
}

function AdvertiserVisual() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <div
      ref={ref}
      className="rounded-xl border border-border/60 bg-background/60 p-4"
    >
      <svg
        viewBox="0 0 240 80"
        className="h-20 w-full"
        aria-hidden="true"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="adv-line-grad" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="oklch(0.62 0.19 150)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="oklch(0.62 0.19 150)" stopOpacity="1" />
          </linearGradient>
        </defs>
        <motion.path
          d="M0 68 L40 60 L80 52 L120 44 L160 30 L200 22 L240 8"
          fill="none"
          stroke="url(#adv-line-grad)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={inView ? { pathLength: 1 } : { pathLength: 0 }}
          transition={{ duration: 2, ease: "easeOut" }}
        />
      </svg>
      <div className="mt-2 flex items-center gap-2 text-xs text-foreground/80">
        <motion.span
          className="h-2 w-2 rounded-full bg-primary"
          animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.3, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
        <span className="font-medium tabular-nums">247</span>
        <span className="text-muted-foreground">активных креативщиков</span>
      </div>
    </div>
  );
}
