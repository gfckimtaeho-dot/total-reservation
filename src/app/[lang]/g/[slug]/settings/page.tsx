import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireGymStaff } from "@/lib/auth/dal";
import { LangToggle } from "@/components/LangToggle";
import { getTheme, type Theme } from "@/lib/theme";
import { updateTheme } from "./actions";

const THEMES: {
  key: Theme;
  label: string;
  description: string;
  swatch: string;
}[] = [
  {
    key: "normal",
    label: "Normal (Paper)",
    description: "amber 종이 배경 + 라임 사이드바. 따뜻하고 눈이 편함.",
    swatch: "bg-amber-100",
  },
  {
    key: "black",
    label: "Black Studio",
    description: "검정 배경 + 형광 라임 accent. 헬스장 brutality.",
    swatch: "bg-zinc-950",
  },
  {
    key: "white",
    label: "White Pastel",
    description: "흰 배경 + 영역별 페일 컬러. 정보별 색 구분.",
    swatch: "bg-sky-100",
  },
];

export default async function GymSettingsPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  const user = await requireGymStaff(slug);
  const business = user.business!;
  const t = await getTranslations("settings");
  const currentTheme = await getTheme();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-zinc-100">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link
            href={`/${lang}/g/${slug}/dashboard`}
            className="font-heading text-2xl tracking-tight text-ink"
          >
            {business.name}
          </Link>
          <Link
            href={`/${lang}/g/${slug}/dashboard`}
            className="text-sm text-zinc-700 transition hover:text-ink"
          >
            {t("back")}
          </Link>
        </div>
      </header>

      <section className="bg-band">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-12 sm:py-16">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/70">
            SETTINGS · {business.slug}
          </span>
          <h1 className="font-heading max-w-2xl text-4xl leading-[1.1] tracking-tight text-ink sm:text-5xl">
            {t("title")}
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-ink/70 sm:text-base">
            {t("subtitle")}
          </p>
        </div>
      </section>

      <main className="flex-1 bg-white">
        <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-12 sm:py-16">
          <SettingCard
            heading={t("language.heading")}
            body={t("language.body")}
          >
            <div className="mt-4 flex items-center gap-4">
              <span className="text-xs text-zinc-500">
                {t("language.current")}:
              </span>
              <LangToggle
                currentLang={lang}
                pathSuffix={`/g/${slug}/settings`}
              />
            </div>
          </SettingCard>

          <SettingCard
            heading="화면 컨셉"
            body="매장 분위기에 맞는 색·톤. 사이드바와 카드 색이 함께 바뀝니다."
          >
            <form action={updateTheme} className="mt-5">
              <div className="grid gap-3 sm:grid-cols-3">
                {THEMES.map((opt) => {
                  const isCurrent = opt.key === currentTheme;
                  return (
                    <label
                      key={opt.key}
                      className={`group cursor-pointer rounded-xl border bg-white p-4 transition hover:border-ink ${
                        isCurrent
                          ? "border-ink ring-1 ring-ink"
                          : "border-zinc-200"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="theme"
                          value={opt.key}
                          defaultChecked={isCurrent}
                          className="h-4 w-4 accent-ink"
                        />
                        <span className="text-sm font-medium text-ink">
                          {opt.label}
                        </span>
                      </div>
                      <div
                        className={`mt-3 h-16 rounded-md ${opt.swatch} ring-1 ring-ink/10`}
                      />
                      <p className="mt-2 text-xs leading-relaxed text-zinc-600">
                        {opt.description}
                      </p>
                    </label>
                  );
                })}
              </div>
              <div className="mt-5 flex items-center justify-between">
                <p className="text-xs text-zinc-500">
                  현재 적용:{" "}
                  <span className="font-medium text-ink">
                    {THEMES.find((x) => x.key === currentTheme)?.label}
                  </span>
                </p>
                <button
                  type="submit"
                  className="h-10 rounded-md bg-ink px-5 text-sm font-medium text-white transition hover:bg-ink/90"
                >
                  적용
                </button>
              </div>
            </form>
          </SettingCard>

          <SettingCard
            heading={t("account.heading")}
            body={t("account.body")}
            soon={t("account.soon")}
          />
          <SettingCard
            heading={t("notification.heading")}
            body={t("notification.body")}
            soon={t("notification.soon")}
          />
          {user.role === "OWNER" && (
            <SettingCard
              heading={t("store.heading")}
              body={t("store.body")}
              soon={t("store.soon")}
            />
          )}
        </div>
      </main>

      <footer className="border-t border-zinc-100 py-6 text-center text-xs text-zinc-500">
        © 2026 예약가즈아 · /g/{business.slug}
      </footer>
    </div>
  );
}

function SettingCard({
  heading,
  body,
  soon,
  children,
}: {
  heading: string;
  body: string;
  soon?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-heading text-xl tracking-tight text-ink">
            {heading}
          </h3>
          <p className="mt-1 text-sm text-zinc-600">{body}</p>
        </div>
        {soon && (
          <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-600">
            {soon}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}
