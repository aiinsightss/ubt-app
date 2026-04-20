import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-16">
      <div className="max-w-2xl w-full text-center space-y-8">

        {/* Beta badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-sm font-medium">
          <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          Ранний доступ
        </div>

        {/* Brand */}
        <div className="space-y-4">
          <h1 className="text-6xl sm:text-7xl font-black tracking-tight text-foreground">
            <span className="text-primary">UBT</span>
          </h1>
          <p className="text-xl sm:text-2xl font-semibold text-foreground/90 leading-snug">
            Маркетплейс органического трафика
          </p>
          <p className="text-base sm:text-lg text-muted-foreground max-w-md mx-auto leading-relaxed">
            Зарабатывай на своих просмотрах или находи креативщиков для своего оффера
          </p>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button size="lg" className="text-base px-8">
            Я креативщик
          </Button>
          <Button size="lg" variant="outline" className="text-base px-8">
            Я рекламодатель
          </Button>
        </div>

        {/* Key features */}
        <div className="grid grid-cols-3 gap-6 pt-8 border-t border-border">
          <div className="space-y-1">
            <div className="text-2xl font-bold text-primary">CPM</div>
            <div className="text-sm text-muted-foreground">Оплата за просмотры</div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-primary">CPA</div>
            <div className="text-sm text-muted-foreground">Оплата за действие</div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-primary">USDT</div>
            <div className="text-sm text-muted-foreground">Выплаты в крипте</div>
          </div>
        </div>

        {/* Platforms */}
        <p className="text-xs text-muted-foreground/60">
          TikTok · Instagram Reels · YouTube Shorts
        </p>

      </div>
    </main>
  );
}
