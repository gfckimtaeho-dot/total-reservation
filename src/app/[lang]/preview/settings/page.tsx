// settings preview — v2 (Normal/Mint Sidebar) 스타일.
// 언어 선택 + 화면 컨셉 (Normal·Dark·White) 라디오 mockup.
// 시안 단계라 인터랙션 없음 (선택 시 실제 테마 적용은 Stage B).

import Link from "next/link";
import { MOCK_BUSINESS, NAV_ITEMS } from "../_mock";

const THEME_OPTIONS = [
  {
    key: "normal",
    label: "Normal (Mint)",
    description: "흰 메인 + 라임 사이드바. 산뜻하고 차분함.",
    previewSlug: "dash-v2",
    swatch: "bg-band",
  },
  {
    key: "dark",
    label: "Dark Studio",
    description: "검정 배경 + 형광 라임 accent. 헬스장 brutality.",
    previewSlug: "dash-v3",
    swatch: "bg-zinc-950",
  },
  {
    key: "white",
    label: "Pastel White",
    description: "흰 배경 + 영역별 페일 컬러. 정보별 색 구분.",
    previewSlug: "dash-v4",
    swatch: "bg-sky-100",
  },
] as const;

const LANG_OPTIONS = [
  { key: "ko", label: "한국어" },
  { key: "en", label: "English" },
] as const;

export default async function SettingsPreview({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  return (
    <div className="flex min-h-screen bg-white">
      <aside className="hidden w-60 shrink-0 flex-col bg-band lg:flex">
        <div className="border-b border-ink/10 px-6 py-6">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/70">
            STUDIO
          </span>
          <div className="mt-1 font-heading text-lg tracking-tight text-ink">
            {MOCK_BUSINESS.name}
          </div>
          <div className="mt-0.5 text-xs text-ink/60">
            /g/{MOCK_BUSINESS.slug}
          </div>
        </div>
        <nav className="flex-1 px-3 py-4">
          <Link
            href={`/${lang}/preview/dash-v2`}
            className="flex items-center rounded-md px-3 py-2 text-sm text-ink/80 transition hover:bg-white/40"
          >
            대시보드
          </Link>
          {NAV_ITEMS.map((n) => {
            const active = n.key === "settings";
            return (
              <a
                key={n.key}
                className={`flex items-center rounded-md px-3 py-2 text-sm transition ${
                  active
                    ? "bg-ink text-white font-medium"
                    : "text-ink/80 hover:bg-white/40"
                }`}
              >
                {n.label}
              </a>
            );
          })}
        </nav>
        <div className="border-t border-ink/10 px-3 py-4">
          <a className="flex items-center rounded-md px-3 py-2 text-sm text-ink/80 hover:bg-white/40">
            로그아웃
          </a>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <header className="border-b border-zinc-100 px-8 py-5">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/60">
            SETTINGS
          </span>
          <h1 className="font-heading text-2xl tracking-tight text-ink">
            설정
          </h1>
        </header>

        <div className="mx-auto max-w-3xl space-y-10 px-8 py-10">
          {/* 1. 언어 선택 */}
          <section>
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/60">
              01
            </span>
            <h2 className="font-heading text-xl tracking-tight text-ink">
              언어 선택
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              사장님·트레이너·고객이 보는 화면의 기본 언어.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {LANG_OPTIONS.map((opt) => (
                <label
                  key={opt.key}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition hover:border-ink ${
                    opt.key === "ko"
                      ? "border-ink bg-band/40"
                      : "border-zinc-200 bg-white"
                  }`}
                >
                  <input
                    type="radio"
                    name="lang"
                    defaultChecked={opt.key === "ko"}
                    className="h-4 w-4 accent-ink"
                  />
                  <span className="text-sm font-medium text-ink">
                    {opt.label}
                  </span>
                </label>
              ))}
            </div>
          </section>

          {/* 2. 화면 컨셉 */}
          <section>
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/60">
              02
            </span>
            <h2 className="font-heading text-xl tracking-tight text-ink">
              화면 컨셉
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              매장 분위기에 맞는 색·톤. 미리보기를 클릭해 비교할 수 있어요.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {THEME_OPTIONS.map((opt, i) => (
                <label
                  key={opt.key}
                  className={`group cursor-pointer rounded-xl border bg-white p-4 transition hover:border-ink ${
                    i === 0 ? "border-ink ring-1 ring-ink" : "border-zinc-200"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="theme"
                      defaultChecked={i === 0}
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
                  <Link
                    href={`/${lang}/preview/${opt.previewSlug}`}
                    className="mt-2 inline-block text-xs font-medium uppercase tracking-[0.18em] text-ink/60 transition hover:text-ink"
                  >
                    미리보기 →
                  </Link>
                </label>
              ))}
            </div>
          </section>

          <div className="flex justify-end gap-2 border-t border-zinc-100 pt-6">
            <button className="h-11 rounded-md border border-zinc-300 bg-white px-5 text-sm text-zinc-700">
              취소
            </button>
            <button className="h-11 rounded-md bg-ink px-5 text-sm font-medium text-white">
              저장
            </button>
          </div>
        </div>

        <footer className="border-t border-zinc-100 px-8 py-5 text-xs text-zinc-500">
          시안 단계 — 저장 동작은 Stage B에서 실제 적용됩니다.
        </footer>
      </main>
    </div>
  );
}
