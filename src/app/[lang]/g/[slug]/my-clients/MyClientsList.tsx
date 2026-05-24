"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Search, User2 } from "lucide-react";

type Row = {
  id: string;
  name: string;
  phone: string | null;
  services: {
    serviceId: string;
    name: string;
    isGroup: boolean;
    left: number;
    upcoming: number;
    done: number;
    remain: number;
    remaining: number;
  }[];
};

// 내 고객 리스트 — client filter(검색). 200 명까진 in-memory filter 빠름.
// row 클릭 → /my-clients/[id] 상세(메모 편집).
export function MyClientsList({
  rows,
  lang,
  slug,
}: {
  rows: Row[];
  lang: string;
  slug: string;
}) {
  const t = useTranslations("dashboard");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(term) ||
        (r.phone ?? "").toLowerCase().includes(term),
    );
  }, [rows, q]);

  return (
    <div className="space-y-3">
      <label className="relative block">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
        />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("myClientsSearchPlaceholder")}
          className="w-full rounded-xl border border-white/10 bg-zinc-900/70 py-3 pl-10 pr-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-400/50 focus:outline-none focus:ring-1 focus:ring-emerald-400/40"
        />
      </label>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-zinc-900/40 p-8 text-center text-sm text-zinc-500">
          {t("myClientsEmpty")}
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((c) => {
            // PT(1:1) 권 먼저 표시 — 빈 셀 모달과 같은 정책.
            const oneToOne = c.services.filter((s) => !s.isGroup);
            const group = c.services.filter((s) => s.isGroup);
            return (
              <li key={c.id}>
                <Link
                  href={`/${lang}/g/${slug}/my-clients/${c.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-zinc-900/60 p-4 transition hover:border-emerald-400/40 hover:bg-zinc-900/80"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30">
                    <User2 size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-lg font-semibold text-white">
                      {c.name}
                    </div>
                    <div className="mt-1.5 flex flex-col gap-1 text-sm">
                      {oneToOne.length > 0 ? (
                        oneToOne.map((s) => (
                          <ServiceMetricLine
                            key={`p-${s.serviceId}`}
                            label={s.name}
                            left={s.left}
                            upcoming={s.upcoming}
                            done={s.done}
                            remain={s.remain}
                            tone="oneToOne"
                          />
                        ))
                      ) : (
                        <span className="text-zinc-600">
                          {t("myClientsNoServices")}
                        </span>
                      )}
                      {group.map((s) => (
                        <ServiceMetricLine
                          key={`g-${s.serviceId}`}
                          label={s.name}
                          left={s.left}
                          upcoming={s.upcoming}
                          done={s.done}
                          remain={s.remain}
                          tone="group"
                        />
                      ))}
                    </div>
                  </div>
                  {c.phone && (
                    <div className="hidden shrink-0 text-base font-medium tabular-nums text-zinc-300 sm:block">
                      {c.phone}
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// service 한 줄 — "{이름}  5 left · 3 예약중 · 1 완료 · 1 잔여" 형식.
// 트레이너가 한눈에 잔여 회수와 예약 가능 횟수를 파악하도록.
function ServiceMetricLine({
  label,
  left,
  upcoming,
  done,
  remain,
  tone,
}: {
  label: string;
  left: number;
  upcoming: number;
  done: number;
  remain: number;
  tone: "oneToOne" | "group";
}) {
  const labelClass = tone === "oneToOne" ? "text-emerald-300" : "text-purple-300";
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className={`font-semibold ${labelClass}`}>{label}</span>
      <span className="tabular-nums text-zinc-300">
        <span className="font-semibold text-white">{left}</span>
        <span className="text-zinc-500"> left</span>
        <span className="mx-1 text-zinc-600">·</span>
        <span className="font-semibold text-orange-300">{upcoming}</span>
        <span className="text-zinc-500"> 예약중</span>
        <span className="mx-1 text-zinc-600">·</span>
        <span className="font-semibold text-emerald-300">{done}</span>
        <span className="text-zinc-500"> 완료</span>
        <span className="mx-1 text-zinc-600">·</span>
        <span className="font-semibold text-amber-300">{remain}</span>
        <span className="text-zinc-500"> 잔여</span>
      </span>
    </div>
  );
}
