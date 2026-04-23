"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

export function DashboardErrorToast() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const error = searchParams.get("error");
    if (error === "advertiser_only") {
      toast.error("Этот раздел доступен только рекламодателям");
      router.replace("/dashboard");
    }
  }, [searchParams, router]);

  return null;
}
