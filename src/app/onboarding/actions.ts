"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";

const NICKNAME_REGEX = /^[a-zA-Z0-9_-]{3,20}$/;
const NICKNAME_ERROR = "Ник: 3-20 символов, латиница, цифры, _ или -";

type AvailabilityResult =
  | { available: true }
  | { available: false; error: string };

type CompleteResult =
  | { success: true }
  | { success?: false; error: string };

export async function checkNicknameAvailability(
  nickname: string,
): Promise<AvailabilityResult> {
  if (!NICKNAME_REGEX.test(nickname)) {
    return { available: false, error: NICKNAME_ERROR };
  }

  const supabase = await createClient();

  // Uniqueness check goes through public_profiles (RLS-free view).
  // Exclude self so the user's default nickname doesn't flag as taken.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let query = supabase
    .from("public_profiles")
    .select("id", { count: "exact", head: true })
    .ilike("nickname", nickname);

  if (user) {
    query = query.neq("id", user.id);
  }

  const { count, error } = await query;

  if (error) {
    console.error(
      "[onboarding/actions] checkNickname failed",
      JSON.stringify(error),
    );
    return {
      available: false,
      error: "Не удалось проверить ник. Попробуй ещё раз.",
    };
  }

  if ((count ?? 0) > 0) {
    return { available: false, error: "Этот ник уже занят" };
  }

  return { available: true };
}

export async function completeOnboarding(data: {
  role: UserRole;
  nickname: string;
}): Promise<CompleteResult> {
  if (data.role !== "creator" && data.role !== "advertiser") {
    return { error: "Недопустимая роль" };
  }

  if (!NICKNAME_REGEX.test(data.nickname)) {
    return { error: NICKNAME_ERROR };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Не авторизован" };
  }

  const { data: existingProfile, error: readError } = await supabase
    .from("public_profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (readError) {
    console.error(
      "[onboarding/actions] read profile failed",
      JSON.stringify(readError),
    );
    return { error: "Не удалось загрузить профиль" };
  }

  if (existingProfile?.role) {
    return { error: "Роль уже выбрана" };
  }

  const { count: nicknameTaken, error: nicknameError } = await supabase
    .from("public_profiles")
    .select("id", { count: "exact", head: true })
    .ilike("nickname", data.nickname)
    .neq("id", user.id);

  if (nicknameError) {
    console.error(
      "[onboarding/actions] nickname race check failed",
      JSON.stringify(nicknameError),
    );
    return { error: "Не удалось проверить ник" };
  }

  if ((nicknameTaken ?? 0) > 0) {
    return { error: "Этот ник только что занял кто-то другой" };
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      role: data.role,
      nickname: data.nickname,
      onboarded_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (updateError) {
    console.error(
      "[onboarding/actions] update profile failed",
      JSON.stringify(updateError),
    );
    return { error: "Не удалось сохранить профиль" };
  }

  const { error: metadataError } = await supabase.auth.updateUser({
    data: { role: data.role, nickname: data.nickname },
  });

  if (metadataError) {
    console.error(
      "[onboarding/actions] updateUser metadata failed (profile was saved)",
      metadataError,
    );
    return { error: "Профиль сохранён, но не удалось обновить сессию. Перелогинься." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/onboarding");

  return { success: true };
}
