"use client";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const handleGoogleLogin = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-16">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="space-y-3">
          <h1 className="text-5xl sm:text-6xl font-black tracking-tight text-foreground">
            <span className="text-primary">UBT</span>
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
            Войди в аккаунт, чтобы начать зарабатывать или запускать офферы
          </p>
        </div>

        <Button
          size="lg"
          className="w-full text-base px-8"
          onClick={handleGoogleLogin}
        >
          Войти через Google
        </Button>

        <p className="text-xs text-muted-foreground/60">
          Нажимая кнопку, ты соглашаешься с правилами сервиса
        </p>
      </div>
    </main>
  );
}
