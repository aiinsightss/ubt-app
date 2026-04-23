"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertCircle,
  ArrowLeft,
  DollarSign,
  FileText,
  Layers,
  Link as LinkIcon,
  Loader2,
  MapPin,
  Megaphone,
  Plus,
  Rocket,
  Tag,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { createOffer, type OfferFormData } from "./actions";

// ─── Types ────────────────────────────────────────────────────────────────────

type PayoutType = "cpm" | "cpa";
type PayoutMode = "flat" | "tiered";

interface TierRow {
  tier_level: number;
  min_views_threshold: string;
  cpm_rate: string;
  cpa_rate: string;
}

interface TierErrors {
  min_views_threshold?: string;
  cpm_rate?: string;
  cpa_rate?: string;
}

interface FormErrors {
  title?: string;
  description?: string;
  cpm_rate?: string;
  cpa_rate?: string;
  cpa_link_template?: string;
  vertical?: string;
  verticality_tier?: string;
  budget_total?: string;
  rules?: string;
}

interface FormProfile {
  role: string | null;
  nickname: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const VERTICALS = [
  { value: "gambling", label: "Гемблинг" },
  { value: "betting", label: "Беттинг" },
  { value: "games", label: "Игры" },
  { value: "saas", label: "SaaS" },
  { value: "crypto", label: "Крипта" },
  { value: "finance", label: "Финансы" },
  { value: "dating", label: "Дейтинг" },
  { value: "nutra", label: "Нутра" },
  { value: "education", label: "Образование" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "other", label: "Другое" },
] as const;

const DEFAULT_TIERS: TierRow[] = [
  { tier_level: 1, min_views_threshold: "0", cpm_rate: "0.05", cpa_rate: "5" },
  { tier_level: 2, min_views_threshold: "100000", cpm_rate: "0.07", cpa_rate: "7" },
  { tier_level: 3, min_views_threshold: "500000", cpm_rate: "0.10", cpa_rate: "10" },
];

// ─── Pure helpers ──────────────────────────────────────────────────────────────

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function areTiersValid(tiers: TierRow[], payoutType: PayoutType): boolean {
  if (tiers.length === 0) return false;
  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i];
    const threshold = parseInt(t.min_views_threshold, 10);
    if (isNaN(threshold) || threshold < 0) return false;
    if (i > 0) {
      const prev = parseInt(tiers[i - 1].min_views_threshold, 10);
      if (!isNaN(prev) && threshold <= prev) return false;
    }
    if (payoutType === "cpm") {
      const r = parseFloat(t.cpm_rate);
      if (isNaN(r) || r <= 0) return false;
    } else {
      const r = parseFloat(t.cpa_rate);
      if (isNaN(r) || r <= 0) return false;
    }
  }
  return true;
}

function validateForm(
  title: string,
  description: string,
  payoutType: PayoutType,
  payoutMode: PayoutMode,
  cpmRate: string,
  cpaRate: string,
  cpaLink: string,
  vertical: string,
  verticality_tier: string,
  budget: string,
  rules: string,
): FormErrors {
  const errors: FormErrors = {};

  const t = title.trim();
  if (t.length < 3 || t.length > 100)
    errors.title = "Название должно быть от 3 до 100 символов";

  if (description.length > 500)
    errors.description = "Максимум 500 символов";

  if (payoutMode === "flat") {
    if (payoutType === "cpm") {
      const r = parseFloat(cpmRate);
      if (!cpmRate || isNaN(r) || r < 0.1 || r > 100)
        errors.cpm_rate = "Ставка должна быть больше 0";
    } else {
      const r = parseFloat(cpaRate);
      if (!cpaRate || isNaN(r) || r < 1 || r > 10000)
        errors.cpa_rate = "Ставка должна быть больше 0";
    }
  }

  if (payoutType === "cpa") {
    if (!cpaLink.trim() || !cpaLink.includes("{subid}") || !isValidUrl(cpaLink))
      errors.cpa_link_template = "Ссылка должна быть валидным URL и содержать {subid}";
  }

  if (!vertical) errors.vertical = "Выбери вертикаль";
  if (!verticality_tier) errors.verticality_tier = "Выбери тип вертикали";

  const b = parseFloat(budget);
  if (!budget || isNaN(b) || b < 50)
    errors.budget_total = "Минимум 50 USDT";

  if (rules.length > 2000)
    errors.rules = "Максимум 2000 символов";

  return errors;
}

function validateTiers(tiers: TierRow[], payoutType: PayoutType): TierErrors[] {
  return tiers.map((t, i) => {
    const errs: TierErrors = {};

    const threshold = parseInt(t.min_views_threshold, 10);
    if (isNaN(threshold) || threshold < 0) {
      errs.min_views_threshold = "Введи число ≥ 0";
    } else if (i > 0) {
      const prev = parseInt(tiers[i - 1].min_views_threshold, 10);
      if (!isNaN(prev) && threshold <= prev)
        errs.min_views_threshold = "Порог должен быть больше чем у предыдущего тира";
    }

    if (payoutType === "cpm") {
      const r = parseFloat(t.cpm_rate);
      if (!t.cpm_rate || isNaN(r) || r <= 0)
        errs.cpm_rate = "Ставка должна быть больше 0";
    } else {
      const r = parseFloat(t.cpa_rate);
      if (!t.cpa_rate || isNaN(r) || r <= 0)
        errs.cpa_rate = "Ставка должна быть больше 0";
    }

    return errs;
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OfferForm({ profile: _ }: { profile: FormProfile }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const titleRef = useRef<HTMLInputElement>(null);

  // Core fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [payoutType, setPayoutType] = useState<PayoutType>("cpm");
  const [payoutMode, setPayoutMode] = useState<PayoutMode>("flat");

  // Flat mode rates
  const [cpmRate, setCpmRate] = useState("");
  const [cpaRate, setCpaRate] = useState("");

  // CPA link
  const [cpaLink, setCpaLink] = useState("");

  // Tiered mode
  const [tiers, setTiers] = useState<TierRow[]>(DEFAULT_TIERS);

  // Category / budget / geo / rules
  const [vertical, setVertical] = useState("");
  const [verticality_tier, setVerticality_tier] = useState("grey");
  const [budget, setBudget] = useState("");
  const [geo, setGeo] = useState("");
  const [rules, setRules] = useState("");

  // Which fields the user has blurred (with a non-empty value at blur time)
  const [blurred, setBlurred] = useState<Partial<Record<keyof FormErrors, boolean>>>({});
  // Which tier fields the user has blurred — key: "${index}-${field}"
  const [tierBlurred, setTierBlurred] = useState<Record<string, boolean>>({});
  const [hasSubmitted, setHasSubmitted] = useState(false);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  // ── Derived ──────────────────────────────────────────────────────────────────

  const formErrors = useMemo(
    () =>
      validateForm(
        title, description, payoutType, payoutMode,
        cpmRate, cpaRate, cpaLink,
        vertical, verticality_tier, budget, rules,
      ),
    [title, description, payoutType, payoutMode, cpmRate, cpaRate, cpaLink, vertical, verticality_tier, budget, rules],
  );

  const computedTierErrors = useMemo(
    () => validateTiers(tiers, payoutType),
    [tiers, payoutType],
  );

  const isValid = useMemo(() => {
    if (title.trim().length < 3) return false;
    if (!vertical || !verticality_tier) return false;
    const b = parseFloat(budget);
    if (!budget || isNaN(b) || b < 50) return false;

    if (payoutMode === "flat") {
      if (payoutType === "cpm") {
        const r = parseFloat(cpmRate);
        if (!cpmRate || isNaN(r) || r < 0.1 || r > 100) return false;
      } else {
        const r = parseFloat(cpaRate);
        if (!cpaRate || isNaN(r) || r < 1) return false;
      }
    } else {
      if (!areTiersValid(tiers, payoutType)) return false;
    }

    if (payoutType === "cpa") {
      if (!cpaLink.includes("{subid}") || !isValidUrl(cpaLink)) return false;
    }

    return true;
  }, [
    title, vertical, verticality_tier, budget,
    payoutMode, payoutType,
    cpmRate, cpaRate, cpaLink, tiers,
  ]);

  // ── Blur / error-display helpers ─────────────────────────────────────────────

  function markBlurred(field: keyof FormErrors, value: string) {
    // Only register a blur if the user actually typed something
    if (value.trim() !== "") {
      setBlurred((prev) => ({ ...prev, [field]: true }));
    }
  }

  function markTierBlurred(
    index: number,
    field: "min_views_threshold" | "cpm_rate" | "cpa_rate",
    value: string,
  ) {
    if (value.trim() !== "") {
      setTierBlurred((prev) => ({ ...prev, [`${index}-${field}`]: true }));
    }
  }

  // Returns the error message to display for a form field.
  // Shows when: submit was attempted OR (field was blurred AND currently non-empty).
  function showError(field: keyof FormErrors, currentValue: string): string | undefined {
    const visible = hasSubmitted || (!!blurred[field] && currentValue.trim() !== "");
    return visible ? formErrors[field] : undefined;
  }

  // Returns the error message to display for a tier field.
  function showTierError(
    index: number,
    field: "min_views_threshold" | "cpm_rate" | "cpa_rate",
    currentValue: string,
  ): string | undefined {
    const visible =
      hasSubmitted || (!!tierBlurred[`${index}-${field}`] && currentValue.trim() !== "");
    return visible ? computedTierErrors[index]?.[field] : undefined;
  }

  // ── Handlers ──────────────────────────────────────────────────────────────────

  function handlePayoutTypeChange(v: string) {
    setPayoutType(v as PayoutType);
    setBlurred((prev) => {
      const next = { ...prev };
      delete next.cpm_rate;
      delete next.cpa_rate;
      delete next.cpa_link_template;
      return next;
    });
    setTierBlurred({});
  }

  function handlePayoutModeChange(v: string) {
    setPayoutMode(v as PayoutMode);
    setBlurred((prev) => {
      const next = { ...prev };
      delete next.cpm_rate;
      delete next.cpa_rate;
      return next;
    });
    setTierBlurred({});
  }

  function updateTier(
    index: number,
    field: "min_views_threshold" | "cpm_rate" | "cpa_rate",
    value: string,
  ) {
    setTiers((prev) =>
      prev.map((t, i) => (i === index ? { ...t, [field]: value } : t)),
    );
  }

  function addTier() {
    if (tiers.length >= 10) return;
    setTiers((prev) => [
      ...prev,
      {
        tier_level: prev.length + 1,
        min_views_threshold: "",
        cpm_rate: "",
        cpa_rate: "",
      },
    ]);
  }

  function removeTier(index: number) {
    setTiers((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((t, i) => ({ ...t, tier_level: i + 1 })),
    );
    // Drop blur state for the removed tier and re-index those above it
    setTierBlurred((prev) => {
      const next: Record<string, boolean> = {};
      for (const [key, val] of Object.entries(prev)) {
        const [idxStr, field] = key.split("-");
        const idx = parseInt(idxStr, 10);
        if (idx === index) continue;
        const newIdx = idx > index ? idx - 1 : idx;
        next[`${newIdx}-${field}`] = val;
      }
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setHasSubmitted(true);

    if (payoutMode === "tiered") {
      const hasTierErrs = computedTierErrors.some(
        (e) => Object.keys(e).length > 0,
      );
      if (hasTierErrs || Object.keys(formErrors).length > 0) return;
    } else {
      if (Object.keys(formErrors).length > 0) return;
    }

    const geoArr = geo
      .split(",")
      .map((g) => g.trim().toUpperCase())
      .filter(Boolean);

    const formData: OfferFormData = {
      title: title.trim(),
      description: description.trim(),
      vertical,
      verticality_tier,
      payout_type: payoutType,
      payout_mode: payoutMode,
      cpm_rate:
        payoutMode === "flat" && payoutType === "cpm" ? parseFloat(cpmRate) : 0,
      cpa_rate:
        payoutMode === "flat" && payoutType === "cpa" ? parseFloat(cpaRate) : 0,
      tiers:
        payoutMode === "tiered"
          ? tiers.map((t) => ({
              tier_level: t.tier_level,
              min_views_threshold: parseInt(t.min_views_threshold, 10),
              cpm_rate: parseFloat(t.cpm_rate),
              cpa_rate: parseFloat(t.cpa_rate),
            }))
          : [],
      cpa_link_template: payoutType === "cpa" ? cpaLink.trim() : "",
      budget_total: parseFloat(budget),
      geo: geoArr,
      rules: rules.trim(),
    };

    startTransition(async () => {
      const result = await createOffer(formData);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success("Оффер опубликован!");
        router.push("/dashboard");
      }
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-background px-4 py-10 sm:py-12">
      <div className="mx-auto w-full max-w-2xl space-y-8">
        {/* Header */}
        <div>
          <Link
            href="/dashboard"
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Назад к дашборду
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Megaphone className="size-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground">
                Создать оффер
              </h1>
              <p className="text-sm text-muted-foreground">
                Запусти рекламную кампанию и получи органический трафик
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* ── Основное ──────────────────────────────────────────────────────── */}
          <section className="space-y-4">
            <SectionHeading icon={<FileText className="size-3.5" />}>
              Основное
            </SectionHeading>

            <div className="space-y-1.5">
              <Label htmlFor="title">Название оффера *</Label>
              <Input
                ref={titleRef}
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={(e) => markBlurred("title", e.target.value)}
                placeholder="Например: Казино 1xBet — регистрация"
                maxLength={100}
                aria-invalid={!!showError("title", title)}
              />
              {showError("title", title) && (
                <FieldError message={showError("title", title)!} />
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Описание</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={(e) => markBlurred("description", e.target.value)}
                placeholder="Коротко расскажи об оффере"
                maxLength={500}
                rows={3}
                aria-invalid={!!showError("description", description)}
              />
              {showError("description", description) && (
                <FieldError message={showError("description", description)!} />
              )}
            </div>
          </section>

          <Separator />

          {/* ── Тип выплаты ───────────────────────────────────────────────────── */}
          <section className="space-y-4">
            <SectionHeading icon={<DollarSign className="size-3.5" />}>
              Тип выплаты
            </SectionHeading>

            <RadioGroup
              value={payoutType}
              onValueChange={handlePayoutTypeChange}
              className="grid-cols-2 gap-3"
            >
              {(
                [
                  { value: "cpm", label: "CPM", desc: "за 1000 просмотров" },
                  {
                    value: "cpa",
                    label: "CPA",
                    desc: "за целевое действие (регистрация, депозит)",
                  },
                ] as const
              ).map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-card/50 p-4 transition-colors has-[[data-checked]]:border-primary/50 has-[[data-checked]]:bg-primary/5"
                >
                  <RadioGroupItem value={opt.value} className="mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground">
                      {opt.label}
                    </div>
                    <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {opt.desc}
                    </div>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </section>

          <Separator />

          {/* ── Режим выплат ──────────────────────────────────────────────────── */}
          <section className="space-y-4">
            <SectionHeading icon={<Layers className="size-3.5" />}>
              Режим выплат
            </SectionHeading>

            <RadioGroup
              value={payoutMode}
              onValueChange={handlePayoutModeChange}
              className="grid-cols-2 gap-3"
            >
              {(
                [
                  {
                    value: "flat",
                    label: "Простая ставка",
                    desc: "одна ставка на весь оффер",
                  },
                  {
                    value: "tiered",
                    label: "Тиры",
                    desc: "ставка растёт с объёмом просмотров",
                  },
                ] as const
              ).map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-card/50 p-4 transition-colors has-[[data-checked]]:border-primary/50 has-[[data-checked]]:bg-primary/5"
                >
                  <RadioGroupItem value={opt.value} className="mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground">
                      {opt.label}
                    </div>
                    <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {opt.desc}
                    </div>
                  </div>
                </label>
              ))}
            </RadioGroup>

            <AnimatePresence mode="wait" initial={false}>
              {payoutMode === "flat" ? (
                <motion.div
                  key="flat"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {payoutType === "cpm" ? (
                      <motion.div
                        key="flat-cpm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.12 }}
                        className="space-y-1.5"
                      >
                        <Label htmlFor="cpm_rate">Ставка CPM *</Label>
                        <div className="flex flex-wrap items-center gap-2">
                          <Input
                            id="cpm_rate"
                            type="number"
                            step="0.1"
                            min="0.1"
                            max="100"
                            value={cpmRate}
                            onChange={(e) => setCpmRate(e.target.value)}
                            onBlur={(e) => markBlurred("cpm_rate", e.target.value)}
                            placeholder="2.5"
                            className="w-36"
                            aria-invalid={!!showError("cpm_rate", cpmRate)}
                          />
                          <span className="text-sm text-muted-foreground">
                            USDT за 1000 просмотров
                          </span>
                        </div>
                        {showError("cpm_rate", cpmRate) && (
                          <FieldError message={showError("cpm_rate", cpmRate)!} />
                        )}
                      </motion.div>
                    ) : (
                      <motion.div
                        key="flat-cpa"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.12 }}
                        className="space-y-1.5"
                      >
                        <Label htmlFor="cpa_rate">Ставка CPA *</Label>
                        <div className="flex flex-wrap items-center gap-2">
                          <Input
                            id="cpa_rate"
                            type="number"
                            step="1"
                            min="1"
                            max="10000"
                            value={cpaRate}
                            onChange={(e) => setCpaRate(e.target.value)}
                            onBlur={(e) => markBlurred("cpa_rate", e.target.value)}
                            placeholder="15"
                            className="w-36"
                            aria-invalid={!!showError("cpa_rate", cpaRate)}
                          />
                          <span className="text-sm text-muted-foreground">
                            USDT за одно действие
                          </span>
                        </div>
                        {showError("cpa_rate", cpaRate) && (
                          <FieldError message={showError("cpa_rate", cpaRate)!} />
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ) : (
                <motion.div
                  key="tiered"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-3"
                >
                  {tiers.map((tier, i) => (
                    <TierCard
                      key={tier.tier_level}
                      tier={tier}
                      index={i}
                      payoutType={payoutType}
                      onUpdate={updateTier}
                      onRemove={removeTier}
                      onBlur={markTierBlurred}
                      showFieldError={(field, value) =>
                        showTierError(i, field, value)
                      }
                    />
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addTier}
                    disabled={tiers.length >= 10}
                    className="gap-1.5"
                  >
                    <Plus className="size-3.5" />
                    Добавить тир
                  </Button>

                  <p className="text-xs text-muted-foreground">
                    Все просмотры пересчитываются по ставке текущего тира.
                    Чем больше просмотров — тем выше тир и ставка.
                  </p>

                  <PreviewExample tiers={tiers} payoutType={payoutType} />
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* ── CPA link (только для CPA) ─────────────────────────────────────── */}
          <AnimatePresence initial={false}>
            {payoutType === "cpa" && (
              <motion.div
                key="cpa-link-section"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                style={{ overflow: "hidden" }}
              >
                <Separator className="mb-8" />
                <section className="space-y-4">
                  <SectionHeading icon={<LinkIcon className="size-3.5" />}>
                    CPA-ссылка
                  </SectionHeading>

                  <div className="space-y-1.5">
                    <Label htmlFor="cpa_link">Партнёрская ссылка *</Label>
                    <Input
                      id="cpa_link"
                      type="url"
                      value={cpaLink}
                      onChange={(e) => setCpaLink(e.target.value)}
                      onBlur={(e) => markBlurred("cpa_link_template", e.target.value)}
                      placeholder="https://partner.com/?ref=123&subid={subid}"
                      aria-invalid={!!showError("cpa_link_template", cpaLink)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Используй{" "}
                      <code className="rounded bg-muted px-1 font-mono text-foreground/70">
                        {"{subid}"}
                      </code>{" "}
                      — мы подставим уникальный токен для каждого креативщика
                    </p>
                    {showError("cpa_link_template", cpaLink) && (
                      <FieldError message={showError("cpa_link_template", cpaLink)!} />
                    )}
                  </div>
                </section>
              </motion.div>
            )}
          </AnimatePresence>

          <Separator />

          {/* ── Категория ─────────────────────────────────────────────────────── */}
          <section className="space-y-4">
            <SectionHeading icon={<Tag className="size-3.5" />}>
              Категория
            </SectionHeading>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Вертикаль *</Label>
                <Select
                  value={vertical || null}
                  onValueChange={(v) => {
                    if (v) setVertical(v);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Выбери вертикаль" />
                  </SelectTrigger>
                  <SelectContent>
                    {VERTICALS.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* vertical has no typed value — only show error on submit */}
                {hasSubmitted && formErrors.vertical && (
                  <FieldError message={formErrors.vertical} />
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Тип вертикали *</Label>
                <Select
                  value={verticality_tier}
                  onValueChange={(v) => {
                    if (v) setVerticality_tier(v);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="white">
                      Белая вертикаль (легальная)
                    </SelectItem>
                    <SelectItem value="grey">Серая вертикаль</SelectItem>
                    <SelectItem value="black">Чёрная вертикаль</SelectItem>
                  </SelectContent>
                </Select>
                {hasSubmitted && formErrors.verticality_tier && (
                  <FieldError message={formErrors.verticality_tier} />
                )}
              </div>
            </div>
          </section>

          <Separator />

          {/* ── Бюджет ────────────────────────────────────────────────────────── */}
          <section className="space-y-4">
            <SectionHeading icon={<DollarSign className="size-3.5" />}>
              Бюджет
            </SectionHeading>

            <div className="space-y-1.5">
              <Label htmlFor="budget">Общий бюджет *</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  id="budget"
                  type="number"
                  step="10"
                  min="50"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  onBlur={(e) => markBlurred("budget_total", e.target.value)}
                  placeholder="500"
                  className="w-36"
                  aria-invalid={!!showError("budget_total", budget)}
                />
                <span className="text-sm text-muted-foreground">USDT</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Минимум 50 USDT. Кампания остановится, когда бюджет исчерпан.
              </p>
              {showError("budget_total", budget) && (
                <FieldError message={showError("budget_total", budget)!} />
              )}
            </div>
          </section>

          <Separator />

          {/* ── География ─────────────────────────────────────────────────────── */}
          <section className="space-y-4">
            <SectionHeading icon={<MapPin className="size-3.5" />} optional>
              География
            </SectionHeading>

            <div className="space-y-1.5">
              <Label htmlFor="geo">Страны</Label>
              <Input
                id="geo"
                value={geo}
                onChange={(e) => setGeo(e.target.value)}
                placeholder="RU, UA, KZ (через запятую)"
              />
              <p className="text-xs text-muted-foreground">
                Оставь пустым — оффер будет показан во всех странах
              </p>
            </div>
          </section>

          <Separator />

          {/* ── Правила ───────────────────────────────────────────────────────── */}
          <section className="space-y-4">
            <SectionHeading icon={<FileText className="size-3.5" />} optional>
              Правила
            </SectionHeading>

            <div className="space-y-1.5">
              <Label htmlFor="rules">Требования к контенту</Label>
              <Textarea
                id="rules"
                value={rules}
                onChange={(e) => setRules(e.target.value)}
                onBlur={(e) => markBlurred("rules", e.target.value)}
                placeholder="Требования к роликам: длительность, упоминания, запрещённые темы"
                maxLength={2000}
                rows={4}
                aria-invalid={!!showError("rules", rules)}
              />
              {showError("rules", rules) && (
                <FieldError message={showError("rules", rules)!} />
              )}
            </div>
          </section>

          {/* ── Submit ────────────────────────────────────────────────────────── */}
          <div className="space-y-2 pt-2">
            <Button
              type="submit"
              size="lg"
              disabled={!isValid || isPending}
              className="h-14 w-full bg-emerald-600 text-base text-white hover:bg-emerald-500"
            >
              {isPending ? (
                <>
                  <Loader2 className="animate-spin" />
                  Публикуем...
                </>
              ) : (
                <>
                  <Rocket />
                  Опубликовать оффер
                </>
              )}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              {isValid
                ? "После публикации оффер сразу станет виден креативщикам"
                : "Заполните все обязательные поля, чтобы опубликовать"}
            </p>
          </div>
        </form>
      </div>
    </main>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeading({
  children,
  icon,
  optional = false,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  optional?: boolean;
}) {
  return (
    <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">
      {icon}
      {children}
      {optional && (
        <span className="font-normal normal-case tracking-normal text-muted-foreground/50">
          (опционально)
        </span>
      )}
    </h2>
  );
}

function FieldError({ message }: { message: string }) {
  return (
    <p className="mt-1 flex items-center gap-1.5 text-sm text-red-400">
      <AlertCircle className="size-3.5 shrink-0" />
      {message}
    </p>
  );
}

function TierCard({
  tier,
  index,
  payoutType,
  onUpdate,
  onRemove,
  onBlur,
  showFieldError,
}: {
  tier: TierRow;
  index: number;
  payoutType: PayoutType;
  onUpdate: (
    index: number,
    field: "min_views_threshold" | "cpm_rate" | "cpa_rate",
    value: string,
  ) => void;
  onRemove: (index: number) => void;
  onBlur: (
    index: number,
    field: "min_views_threshold" | "cpm_rate" | "cpa_rate",
    value: string,
  ) => void;
  showFieldError: (
    field: "min_views_threshold" | "cpm_rate" | "cpa_rate",
    value: string,
  ) => string | undefined;
}) {
  const rateField = payoutType === "cpm" ? "cpm_rate" : "cpa_rate";
  const rateValue = payoutType === "cpm" ? tier.cpm_rate : tier.cpa_rate;

  const thresholdError = showFieldError("min_views_threshold", tier.min_views_threshold);
  const rateError = showFieldError(rateField, rateValue);

  return (
    <div className="rounded-xl border border-border bg-card/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">
          Тир {tier.tier_level}
        </span>
        {index > 0 && (
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="flex items-center justify-center rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={`Удалить тир ${tier.tier_level}`}
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">От просмотров</Label>
          <Input
            type="number"
            min="0"
            step="1000"
            value={tier.min_views_threshold}
            onChange={(e) => onUpdate(index, "min_views_threshold", e.target.value)}
            onBlur={(e) => onBlur(index, "min_views_threshold", e.target.value)}
            placeholder={index === 0 ? "0 (опционально)" : "100000"}
            aria-invalid={!!thresholdError}
          />
          {thresholdError && <FieldError message={thresholdError} />}
        </div>

        <div className="space-y-1">
          <Label className="text-xs">
            Ставка {payoutType === "cpm" ? "CPM" : "CPA"}
          </Label>
          <Input
            type="number"
            min="0"
            step={payoutType === "cpm" ? "0.01" : "1"}
            value={rateValue}
            onChange={(e) => onUpdate(index, rateField, e.target.value)}
            onBlur={(e) => onBlur(index, rateField, e.target.value)}
            placeholder={payoutType === "cpm" ? "0.07" : "7"}
            aria-invalid={!!rateError}
          />
          <p className="text-[11px] text-muted-foreground">
            {payoutType === "cpm" ? "USDT / 1000 просмотров" : "USDT / действие"}
          </p>
          {rateError && <FieldError message={rateError} />}
        </div>
      </div>
    </div>
  );
}

function PreviewExample({
  tiers,
  payoutType,
}: {
  tiers: TierRow[];
  payoutType: PayoutType;
}) {
  const validTiers = tiers.filter((t) => {
    const threshold = parseInt(t.min_views_threshold, 10);
    const rate = parseFloat(payoutType === "cpm" ? t.cpm_rate : t.cpa_rate);
    return !isNaN(threshold) && threshold >= 0 && !isNaN(rate) && rate > 0;
  });

  if (validTiers.length < 2) return null;

  const t2 = validTiers[1];
  const t3 = validTiers[2];
  const threshold2 = parseInt(t2.min_views_threshold, 10);
  const exampleViews = t3
    ? Math.round((threshold2 + parseInt(t3.min_views_threshold, 10)) / 2)
    : threshold2 * 3;

  let activeRate = parseFloat(payoutType === "cpm" ? t2.cpm_rate : t2.cpa_rate);
  let activeTierLevel = t2.tier_level;
  for (const t of validTiers) {
    const thr = parseInt(t.min_views_threshold, 10);
    const r = parseFloat(payoutType === "cpm" ? t.cpm_rate : t.cpa_rate);
    if (!isNaN(thr) && thr <= exampleViews && !isNaN(r) && r > 0) {
      activeRate = r;
      activeTierLevel = t.tier_level;
    }
  }

  const numFmt = new Intl.NumberFormat("ru-RU");

  if (payoutType === "cpm") {
    const earnings = (exampleViews * activeRate) / 1000;
    return (
      <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Пример: </span>
        ролик с {numFmt.format(exampleViews)} просмотров (Тир {activeTierLevel})
        {" = "}{numFmt.format(exampleViews)} × ${activeRate.toFixed(2)} / 1000{" = "}
        <span className="font-semibold text-foreground">
          ${earnings.toFixed(2)}
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">Пример: </span>
      ролик с {numFmt.format(exampleViews)} просмотров попадает в{" "}
      <span className="text-foreground">Тир {activeTierLevel}</span> — ставка{" "}
      <span className="font-semibold text-foreground">
        ${activeRate.toFixed(2)}
      </span>{" "}
      за действие
    </div>
  );
}
