# UBT — Organic Traffic Marketplace

UBT is a marketplace that connects advertisers with content creators (TikTok, Instagram Reels, YouTube Shorts) to drive organic (UBT) traffic across multiple verticals.

## What It Does

**For advertisers** — post offers with payout terms, rules, and creative requirements across any vertical:
- iGaming (casinos, gambling)
- Betting (sports betting)
- VPN & cybersecurity
- Mobile & desktop games
- Crypto projects
- Finance (trading, forex, neo-banks)
- Dating
- E-commerce & product offers
- SaaS & white-hat services
- Nutra & wellness
- Education & info products
- Any other legal vertical

**For creators** — pick offers, create short-form videos, earn money on your views (CPM) or conversions (CPA). Payouts in USDT via crypto processing.

## Distribution Strategy

- **App Store / Google Play** — white-label version, shows only white-hat verticals (SaaS, games, e-commerce, education). Grey/black verticals filtered by feature flags.
- **PWA (web)** — full version accessible via direct URL, all verticals available.

Each offer has a `verticality_tier` field (`white` / `grey` / `black`) for filtering based on distribution channel.

## Tech Stack

- [Next.js 14+](https://nextjs.org/) — App Router, TypeScript
- [Tailwind CSS](https://tailwindcss.com/) — styling
- [shadcn/ui](https://ui.shadcn.com/) — component library (Slate theme, green primary)
- [Supabase](https://supabase.com/) — database, auth, file storage
- [Vercel](https://vercel.com/) — deployment
- PWA-ready from day one

## Monetization for Creators

- **CPM** — pay per 1000 views
- **CPA** — pay per target action via personal referral link
- **Gamification** — levels, XP, leaderboards, achievements
- **Payouts** — USDT via crypto processing

## Getting Started

```bash
npm install
cp .env.local.example .env.local  # fill in your Supabase keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.
