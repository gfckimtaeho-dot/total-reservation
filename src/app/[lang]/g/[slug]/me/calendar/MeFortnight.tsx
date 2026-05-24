"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  loadMeDaySheet,
  joinScheduledClass,
  type MeDaySheetData,
} from "../actions";
import type { MeFortnight } from "@/lib/calendar/meFortnight";

const WD_KO = ["일", "월", "화", "수", "목", "금", "토"];
const WD_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function hm(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(
    min % 60,
  ).padStart(2, "0")}`;
}

// 가로 스크롤 14일 + 2주간 내 예약 + 선택일 옵션 한 페이지.
//  - 가로 스크롤: viewport 에 5칸이 들어가도록 칸 폭 = 20%. snap-x 로 깔끔 정렬.
//  - 선택일 default = 오늘. 클릭하면 loadMeDaySheet 로 그 날 옵션 갱신.
//  - 옵션은 단체수업(인라인 confirm 으로 신청) + 1:1(별도 페이지로 이동).
export function MeFortnight({
  slug,
  lang,
  fortnight,
  initialSheet,
}: {
  slug: string;
  lang: string;
  fortnight: MeFortnight;
  initialSheet: MeDaySheetData;
}) {
  const t = useTranslations("me");
  const router = useRouter();
  const WD = lang === "en" ? WD_EN : WD_KO;

  const [selectedKey, setSelectedKey] = useState(fortnight.todayKey);
  const [sheet, setSheet] = useState<MeDaySheetData>(initialSheet);
  const [sheetLoaded, setSheetLoaded] = useState(true);
  const [pending, startTransition] = useTransition();
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 같은 날 두 번째 클릭부터 즉시 표시 — Neon 왕복(750ms~)을 캐시로 잘라낸다.
  // 액션 성공(act)이나 prefetch 결과는 캐시 갱신.
  const cacheRef = useRef<Map<string, MeDaySheetData>>(
    new Map([[fortnight.todayKey, initialSheet]]),
  );

  function fetchAndCache(dayKey: string): Promise<MeDaySheetData> {
    return loadMeDaySheet(slug, dayKey).then((fresh) => {
      cacheRef.current.set(dayKey, fresh);
      return fresh;
    });
  }

  // 다른 날 클릭 — 캐시 있으면 즉시, 없으면 fetch.
  function selectDay(dayKey: string) {
    setError(null);
    setConfirmKey(null);
    setSelectedKey(dayKey);
    const cached = cacheRef.current.get(dayKey);
    if (cached) {
      setSheet(cached);
      setSheetLoaded(true);
      return;
    }
    setSheetLoaded(false);
    void fetchAndCache(dayKey).then((fresh) => {
      setSheet(fresh);
      setSheetLoaded(true);
    });
  }

  // pointerdown(탭 시작) 시 prefetch — 사용자 손가락이 떨어지기 전에 요청을
  // 보내 체감 100~200ms 단축. 캐시 hit 면 skip.
  function prefetchDay(dayKey: string) {
    if (cacheRef.current.has(dayKey)) return;
    void fetchAndCache(dayKey);
  }

  function act(fn: () => Promise<{ ok: boolean }>) {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) {
        setError(t("meDayError"));
        return;
      }
      setConfirmKey(null);
      // 액션 후 그 날 캐시는 무효 — 재조회 후 캐시 갱신.
      cacheRef.current.delete(selectedKey);
      const fresh = await fetchAndCache(selectedKey);
      setSheet(fresh);
      router.refresh();
    });
  }

  function goBook(packageId: string) {
    router.push(
      `/${lang}/g/${slug}/me/reservations/new?pkg=${packageId}&date=${selectedKey}`,
    );
  }

  // 14일 본인 예약 합쳐서 시간순.
  const myUpcoming = fortnight.cells.flatMap((c) =>
    c.events.map((ev) => ({ ...ev, dayKey: c.dayKey })),
  );

  const selected = fortnight.cells.find((c) => c.dayKey === selectedKey);
  const selectedDateLabel = selected
    ? formatDayLabel(selected.dayKey, lang)
    : "";

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-orange-200/60 bg-white/90 p-3 backdrop-blur">
        <FortnightStrip
          cells={fortnight.cells}
          weekdays={WD}
          selectedKey={selectedKey}
          onSelect={selectDay}
          onPrefetch={prefetchDay}
        />
      </section>

      {/* 선택일 옵션 — 가로 strip 바로 아래 배치 (2주간 내 예약 위). 일자
          탭하면 즉시 보이도록. */}
      <section className="rounded-3xl border border-orange-200/60 bg-white/90 p-5 backdrop-blur">
        <div className="flex items-baseline justify-between">
          <h3 className="text-lg font-bold text-orange-600">
            {t("fnOptions")}
          </h3>
          <span className="text-base text-zinc-500">{selectedDateLabel}</span>
        </div>

        {selected && !selected.isOpen ? (
          <div className="mt-3 rounded-2xl bg-zinc-100 p-4 text-center text-sm text-zinc-600">
            {t("fnSelectedClosed")}
          </div>
        ) : !sheetLoaded ? (
          <div className="mt-3 rounded-2xl bg-zinc-50 p-4 text-center text-sm text-zinc-500">
            {t("meDayLoading")}
          </div>
        ) : sheet.options.length === 0 ? (
          <div className="mt-3 rounded-2xl bg-zinc-50 p-4 text-center text-sm text-zinc-500">
            {sheet.hasPasses ? t("fnNoOptions") : t("fnNoPass")}
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {sheet.options.map((opt) => {
              if (opt.kind === "group") {
                const rowKey = `gc-${opt.scheduleId}`;
                const [y, mon, d] = selectedKey.split("-").map(Number) as [
                  number,
                  number,
                  number,
                ];
                return (
                  <li
                    key={rowKey}
                    className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-lg font-bold tabular-nums text-emerald-700">
                        {hm(opt.startMin)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-base font-medium text-zinc-900">
                        {t("fnGroup", { service: opt.serviceName })}
                      </span>
                    </div>
                    <div className="mt-2 flex justify-end">
                      {confirmKey === rowKey ? (
                        <InlineConfirm
                          pending={pending}
                          onYes={() =>
                            act(() =>
                              joinScheduledClass(
                                slug,
                                opt.scheduleId,
                                y,
                                mon,
                                d,
                              ),
                            )
                          }
                          onNo={() => setConfirmKey(null)}
                          yesLabel={t("meDayYes")}
                          confirmLabel={t("meDayConfirm")}
                          noLabel={t("cancelConfirmNo")}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmKey(rowKey)}
                          className="rounded-full bg-emerald-100 px-4 py-1.5 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-300 hover:bg-emerald-200"
                        >
                          {t("classJoinBtn")}
                        </button>
                      )}
                    </div>
                  </li>
                );
              }

              const reasonText = !opt.available
                ? opt.reason === "exhausted"
                  ? t("fnExhausted")
                  : opt.reason === "leave"
                    ? t("fnTrainerLeave", { trainer: opt.trainerName })
                    : opt.reason === "full"
                      ? t("fnTrainerFull", { trainer: opt.trainerName })
                      : opt.reason === "noTrainer"
                        ? t("fnNoTrainer")
                        : t("fnTrainerOff", { trainer: opt.trainerName })
                : "";
              const isNoTrainer = opt.reason === "noTrainer";
              return (
                <li
                  key={`pkg-${opt.packageId}`}
                  className={
                    "rounded-2xl border p-3 " +
                    (opt.available
                      ? "border-orange-200 bg-gradient-to-r from-orange-100 to-rose-100"
                      : isNoTrainer
                        ? "border-amber-300 bg-amber-50"
                        : "border-zinc-200 bg-zinc-50")
                  }
                >
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <div
                        className={
                          "truncate text-base font-medium " +
                          (opt.available
                            ? "text-zinc-900"
                            : isNoTrainer
                              ? "text-amber-900"
                              : "text-zinc-500")
                        }
                      >
                        {isNoTrainer
                          ? opt.serviceName
                          : t("fn1to1", {
                              service: opt.serviceName,
                              trainer: opt.trainerName,
                            })}
                      </div>
                      {reasonText && (
                        <div
                          className={
                            "mt-0.5 text-xs " +
                            (isNoTrainer ? "text-amber-700" : "text-zinc-500")
                          }
                        >
                          {reasonText}
                        </div>
                      )}
                    </div>
                    {opt.available && (
                      <button
                        type="button"
                        onClick={() => goBook(opt.packageId)}
                        className="shrink-0 rounded-full bg-orange-500 px-4 py-1.5 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(249,115,22,0.6)] hover:bg-orange-600"
                      >
                        {t("actionBook")}
                      </button>
                    )}
                    {isNoTrainer && (
                      <a
                        href={`/${lang}/g/${slug}/me/holdings/${opt.packageId}/trainer?next=${encodeURIComponent(
                          `/${lang}/g/${slug}/me/reservations/new?pkg=${opt.packageId}&date=${selectedKey}`,
                        )}`}
                        className="shrink-0 rounded-full bg-amber-500 px-4 py-1.5 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(245,158,11,0.6)] hover:bg-amber-600"
                      >
                        {t("actionPickTrainer")}
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {error && <p className="mt-3 text-xs text-rose-700">{error}</p>}
      </section>

      <section className="rounded-3xl border border-orange-200/60 bg-white/90 p-5 backdrop-blur">
        <h3 className="text-lg font-bold text-orange-600">{t("fnMyResv")}</h3>
        {myUpcoming.length === 0 ? (
          <div className="mt-3 rounded-2xl bg-zinc-50 p-4 text-center text-sm text-zinc-500">
            {t("fnMyResvEmpty")}
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {myUpcoming.map((ev) => {
              const cellLabel = shortDayLabel(ev.dayKey, lang, WD);
              const done = ev.status === "COMPLETED";
              return (
                <li
                  key={ev.id}
                  className={
                    "grid grid-cols-[auto_auto_1fr_auto] items-baseline gap-x-3 rounded-2xl p-3 " +
                    (done
                      ? "bg-emerald-100 text-emerald-900"
                      : ev.kind === "group"
                        ? "bg-amber-100 text-amber-900"
                        : "bg-gradient-to-r from-orange-200 to-rose-200 text-orange-900")
                  }
                >
                  <span className="text-sm font-semibold tabular-nums">
                    {cellLabel}
                  </span>
                  <span className="text-lg font-bold tabular-nums">
                    {hm(ev.startMin)}
                  </span>
                  <span className="truncate text-base font-bold">
                    {done && "✓ "}
                    {ev.label}
                  </span>
                  {ev.staffName && (
                    <span className="text-xs">
                      <span className="font-semibold">{ev.staffName}</span>{" "}
                      <span className="text-zinc-600">Tr</span>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

// 가로 스크롤 14일 strip. 한 viewport 에 5칸 표시 — 칸 폭 = 20%.
function FortnightStrip({
  cells,
  weekdays,
  selectedKey,
  onSelect,
  onPrefetch,
}: {
  cells: MeFortnight["cells"];
  weekdays: string[];
  selectedKey: string;
  onSelect: (k: string) => void;
  onPrefetch: (k: string) => void;
}) {
  return (
    <div className="-mx-1 overflow-x-auto pb-1 snap-x snap-mandatory">
      <div className="flex min-w-full">
        {cells.map((c) => {
          const wd = weekdays[c.weekdayIdx]!;
          const selected = c.dayKey === selectedKey;
          const hasMine = c.events.length > 0;
          const hasGroup = c.groupClasses.length > 0;
          const containerCls = selected
            ? "border-orange-500 bg-orange-500 text-white shadow-[0_10px_25px_-12px_rgba(249,115,22,0.7)]"
            : !c.isOpen
              ? "border-zinc-200 bg-zinc-100 text-zinc-400"
              : c.isToday
                ? "border-orange-300 bg-orange-50 text-orange-700"
                : "border-orange-100 bg-white text-zinc-700";
          const wdCls = selected
            ? "text-white/80"
            : !c.isOpen
              ? "text-zinc-400"
              : "text-zinc-500";
          return (
            <button
              key={c.dayKey}
              type="button"
              onClick={() => onSelect(c.dayKey)}
              onPointerDown={() => onPrefetch(c.dayKey)}
              className={
                "snap-start mx-1 flex w-[calc(20%-0.5rem)] shrink-0 flex-col items-center rounded-2xl border p-2 transition " +
                containerCls
              }
            >
              <div className={"text-[10px] font-semibold uppercase " + wdCls}>
                {wd}
              </div>
              <div className="mt-1 text-2xl font-bold tabular-nums">
                {c.day}
              </div>
              {/* 시그널 영역 — 본인 예약 칩 또는 단체 점, 둘 다면 칩 우선 */}
              <div className="mt-1 flex h-3 items-center justify-center gap-1">
                {hasMine ? (
                  <span
                    className={
                      "rounded-full px-1.5 text-[9px] font-bold tabular-nums " +
                      (selected
                        ? "bg-white/30 text-white"
                        : "bg-orange-500 text-white")
                    }
                  >
                    {hm(c.events[0]!.startMin)}
                  </span>
                ) : hasGroup ? (
                  <span
                    className={
                      "h-1.5 w-1.5 rounded-full " +
                      (selected ? "bg-white" : "bg-emerald-500")
                    }
                  />
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function InlineConfirm({
  pending,
  onYes,
  onNo,
  yesLabel,
  confirmLabel,
  noLabel,
}: {
  pending: boolean;
  onYes: () => void;
  onNo: () => void;
  yesLabel: string;
  confirmLabel: string;
  noLabel: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-zinc-500">{confirmLabel}</span>
      <button
        type="button"
        disabled={pending}
        onClick={onYes}
        className="rounded-full bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-50"
      >
        {yesLabel}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={onNo}
        className="rounded-full bg-white px-3 py-1.5 text-xs text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50 disabled:opacity-50"
      >
        {noLabel}
      </button>
    </div>
  );
}

function formatDayLabel(dayKey: string, lang: string): string {
  const [y, m, d] = dayKey.split("-").map(Number) as [number, number, number];
  const noon = new Date(Date.UTC(y, m - 1, d, 12));
  const wd = new Intl.DateTimeFormat(
    lang === "en" ? "en-US" : "ko-KR",
    { weekday: "short", timeZone: "UTC" },
  ).format(noon);
  const md = new Intl.DateTimeFormat(
    lang === "en" ? "en-US" : "ko-KR",
    { month: "long", day: "numeric", timeZone: "UTC" },
  ).format(noon);
  return `${md} (${wd})`;
}

function shortDayLabel(
  dayKey: string,
  lang: string,
  weekdays: string[],
): string {
  const [y, m, d] = dayKey.split("-").map(Number) as [number, number, number];
  const noon = new Date(Date.UTC(y, m - 1, d, 12));
  const wd = weekdays[noon.getUTCDay()]!;
  if (lang === "en") return `${m}/${d} (${wd})`;
  return `${m}/${d} (${wd})`;
}
