import { cookies } from "next/headers";

export type Theme = "normal" | "black" | "white";

const COOKIE_NAME = "tr_theme";
const ONE_YEAR = 60 * 60 * 24 * 365;

export async function getTheme(): Promise<Theme> {
  const c = await cookies();
  const v = c.get(COOKIE_NAME)?.value;
  if (v === "black" || v === "white") return v;
  return "normal";
}

export async function setThemeCookie(theme: Theme): Promise<void> {
  const c = await cookies();
  c.set(COOKIE_NAME, theme, {
    sameSite: "lax",
    maxAge: ONE_YEAR,
    path: "/",
  });
}
