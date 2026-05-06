"use server";

import { revalidatePath } from "next/cache";
import { setThemeCookie, type Theme } from "@/lib/theme";

export async function updateTheme(formData: FormData): Promise<void> {
  const v = String(formData.get("theme") ?? "");
  const theme: Theme = v === "black" || v === "white" ? v : "normal";
  await setThemeCookie(theme);
  revalidatePath("/", "layout");
}
