"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ArrowRight, Filter, PackageSearch } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type {
  Offer,
  OfferPayoutTier,
  PublicProfile,
} from "@/types/database";

// ── Types ────────────────────────────────────────────────────────────────────

export interface OfferCatalogItem extends Offer {
  offer_payout_tiers: OfferPayoutTier[];
  advertiser: Pick<PublicProfile, "id" | "nickname" | "avatar_url"> | null;
}

interface Props {
  offers: OfferCatalogItem[];
  currentVertical: string | null;
}

// ── Constants ────────────────────────────────────────────────────────────────

const ALL_VALUE = "all";

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

const VERTICAL_LABEL: Record<string, string> = Object.fromEntries(
  VERTICALS.map((v) => [v.value, v.label]),
);

const VERTICAL_COLOR: Record<string, string> = {
  gambling: "bg-green-500/15 text-green-300 ring-green-500/30",
  betting: "bg-green-500/15 text-green-300 ring-green-500/30",
  crypto: "bg-purple-500/15 text-purple-300 ring-purple-500/30",
  finance: "bg-purple-500/15 text-purple-300 ring-purple-500/30",
  saas: "bg-blue-500/15 text-blue-300 ring-blue-500/30",
  games: "bg-blue-500/15 text-blue-300 ring-blue-500/30",
  dating: "bg-pink-500/15 text-pink-300 ring-pink-500/30",
  nutra: "bg-orange-500/15 text-orange-300 ring-orange-500/30",
  ecommerce: "bg-orange-500/15 text-orange-300 ring-orange-500/30",
  education: "bg-teal-500/15 text-teal-300 ring-teal-500/30",
  other: "bg-slate-500/15 text-slate-300 ring-slate-500/30",
};

function verticalColor(v: string): string {
  return VERTICAL_COLOR[v] ?? "bg-slate-500/15 text-slate-300 ring-slate-500/30";
}

// ── Formatters ───────────────────────────────────────────────────────────────

const ruInt = new Intl.NumberFormat("ru-RU");
const ruDecimal = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function fmtMoney(raw: string | number | null | undefined): string {
  const n = typeof raw === "number" ? raw : raw ? Number.parseFloat(raw) : 0;
  if (!Number.isFinite(n)) return "$0";
  return Number.isInteger(n) ? `$${ruInt.format(n)}` : `$${ruDecimal.format(n)}`;
}

// ── Rate extraction ──────────────────────────────────────────────────────────

interface RateDisplay {
  label: string;
  isTiered: boolean;
}

function computeRate(offer: OfferCatalogItem): RateDisplay {
  const unit = offer.payout_type === "cpm" ? "за 1000" : "за действие";

  if (offer.payout_mode === "tiered" && offer.offer_payout_tiers.length > 0) {
    const rates = offer.offer_payout_tiers
      .map((t) =>
        Number.parseFloat(offer.payout_type === "cpm" ? t.cpm_rate : t.cpa_rate),
      )
      .filter((r) => Number.isFinite(r));

    if (rates.length === 0) {
      return { label: `— ${unit}`, isTiered: true };
    }

    const min = Math.min(...rates);
    const max = Math.max(...rates);

    if (min === max) {
      return { label: `${fmtMoney(min)} ${unit}`, isTiered: true };
    }
    return {
      label: `от ${fmtMoney(min)} до ${fmtMoney(max)} ${unit}`,
      isTiered: true,
    };
  }

  const flat =
    offer.payout_type === "cpm" ? offer.cpm_rate : offer.cpa_rate;
  return { label: `${fmtMoney(flat)} ${unit}`, isTiered: false };
}

// ── Component ────────────────────────────────────────────────────────────────

export function OffersCatalog({ offers, currentVertical }: Props) {
  const router = useRouter();

  const handleVerticalChange = (value: string | null) => {
    if (!value || value === ALL_VALUE) {
      router.push("/offers");
    } else {
      router.push(`/offers?vertical=${value}`);
    }
  };

  const selectValue = currentVertical ?? ALL_VALUE;
  const currentLabel = currentVertical
    ? (VERTICAL_LABEL[currentVertical] ?? currentVertical)
    : null;

  return (
    <main className="min-h-screen bg-background px-4 py-10 sm:py-12">
      <div className="mx-auto w-full max-w-4xl space-y-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Каталог офферов
            </h1>
            <p className="text-sm text-muted-foreground">
              Выбери оффер и начни зарабатывать
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="size-4 text-muted-foreground" />
            <Select value={selectValue} onValueChange={handleVerticalChange}>
              <SelectTrigger className="h-9 min-w-[180px]">
                <SelectValue>
                  {(value) =>
                    !value || value === ALL_VALUE
                      ? "Все категории"
                      : (VERTICAL_LABEL[value as string] ?? (value as string))
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>Все категории</SelectItem>
                {VERTICALS.map((v) => (
                  <SelectItem key={v.value} value={v.value}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </header>

        {offers.length === 0 ? (
          <EmptyState
            filteredLabel={currentLabel}
            onReset={() => router.push("/offers")}
          />
        ) : (
          <section className="flex flex-col gap-3">
            {offers.map((offer) => (
              <OfferCard key={offer.id} offer={offer} />
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

// ── Card ─────────────────────────────────────────────────────────────────────

function OfferCard({ offer }: { offer: OfferCatalogItem }) {
  const rate = computeRate(offer);
  const verticalLabel = VERTICAL_LABEL[offer.vertical] ?? offer.vertical;
  const geo = offer.geo ?? [];

  return (
    <Link href={`/offers/${offer.id}`} className="block">
      <motion.div
        whileHover={{ y: -2 }}
        transition={{ duration: 0.15 }}
        className={cn(
          "flex flex-col gap-4 rounded-2xl border border-slate-800 bg-card p-5",
          "transition-colors hover:border-green-500/50 sm:flex-row sm:items-start sm:justify-between sm:gap-6",
        )}
      >
        {/* Left block */}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-bold text-foreground">{offer.title}</h3>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset",
                verticalColor(offer.vertical),
              )}
            >
              {verticalLabel}
            </span>
          </div>

          {offer.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {offer.description}
            </p>
          )}

          {offer.advertiser && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {offer.advertiser.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={offer.advertiser.avatar_url}
                  alt={offer.advertiser.nickname}
                  referrerPolicy="no-referrer"
                  className="size-5 rounded-full"
                />
              ) : (
                <div className="size-5 rounded-full bg-muted" />
              )}
              <span className="truncate">{offer.advertiser.nickname}</span>
            </div>
          )}
        </div>

        {/* Right block */}
        <div className="flex flex-col gap-2 sm:min-w-[240px] sm:items-end sm:text-right">
          <div className="flex items-center gap-2 sm:justify-end">
            <Badge
              variant="outline"
              className="border-slate-700 text-muted-foreground uppercase tracking-wider"
            >
              {offer.payout_type === "cpm" ? "CPM" : "CPA"}
            </Badge>
            {rate.isTiered && (
              <Badge
                variant="outline"
                className="border-green-500/40 text-green-400"
              >
                Тиры
              </Badge>
            )}
          </div>

          <div className="text-lg font-bold text-green-400">{rate.label}</div>

          <div className="text-xs text-muted-foreground">
            Бюджет: {fmtMoney(offer.budget_spent)} /{" "}
            {fmtMoney(offer.budget_total)}
          </div>

          <div className="flex flex-wrap gap-1 sm:justify-end">
            {geo.length === 0 ? (
              <Badge
                variant="outline"
                className="border-slate-700 text-muted-foreground"
              >
                Все страны
              </Badge>
            ) : (
              <>
                {geo.slice(0, 3).map((code) => (
                  <Badge
                    key={code}
                    variant="outline"
                    className="border-slate-700 text-muted-foreground"
                  >
                    {code}
                  </Badge>
                ))}
                {geo.length > 3 && (
                  <Badge
                    variant="outline"
                    className="border-slate-700 text-muted-foreground"
                  >
                    +{geo.length - 3}
                  </Badge>
                )}
              </>
            )}
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({
  filteredLabel,
  onReset,
}: {
  filteredLabel: string | null;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-slate-800 bg-card/50 px-6 py-16 text-center">
      <PackageSearch className="size-12 text-muted-foreground/60" />
      {filteredLabel ? (
        <>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">
              Офферов пока нет
            </h2>
            <p className="text-sm text-muted-foreground">
              По категории «{filteredLabel}» ничего не найдено
            </p>
          </div>
          <Button variant="outline" onClick={onReset}>
            Сбросить фильтр
            <ArrowRight />
          </Button>
        </>
      ) : (
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">
            Офферов пока нет
          </h2>
          <p className="text-sm text-muted-foreground">
            Скоро здесь появятся новые предложения
          </p>
        </div>
      )}
    </div>
  );
}
