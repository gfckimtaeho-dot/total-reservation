import Link from "next/link";

// Header-inline KO/EN switcher. Used on public entry pages (landing, register,
// login). Inside the logged-in app the language is changed from the Settings
// page instead, to keep app headers uncluttered.
//
// `pathSuffix` is everything after the lang segment (e.g. "/login",
// "/register?token=abc", "/g/stronghealth/login") so query string is preserved.

export function LangToggle({
  currentLang,
  pathSuffix,
}: {
  currentLang: string;
  pathSuffix: string;
}) {
  const cell = (target: "ko" | "en", label: string) =>
    target === currentLang ? (
      <span className="font-medium text-ink">{label}</span>
    ) : (
      <Link
        href={`/${target}${pathSuffix}`}
        className="text-zinc-500 transition hover:text-ink"
      >
        {label}
      </Link>
    );

  return (
    <div className="flex items-center gap-2 text-sm">
      {cell("ko", "한국어")}
      <span className="text-zinc-300">·</span>
      {cell("en", "English")}
    </div>
  );
}
