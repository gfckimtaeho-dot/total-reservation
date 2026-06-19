import type { Viewport } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { logout } from "@/lib/auth/actions";
import { requireGymCustomer } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/client";
import { gymTodayUtcMidnight } from "@/lib/calendar/gymTime";
import { requestAccessQr, type AccessQrResult } from "./actions";
import { CustomerChatCard } from "./CustomerChatCard";

type T = (key: string, vars?: Record<string, string | number>) => string;

// V18 Sunset Peach (A · Glass Depth 다듬기) — 화이트 + 오렌지/로즈/앰버 그라데이션
// + 유리감 카드(반투명/blur/다층 그림자). 모바일 상태바도 흰색 매칭.
export const viewport: Viewport = {
  themeColor: "#ffffff",
};

// 라인 아이콘 (CTA 용).
function Icon({ d, className = "" }: { d: string; className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}
const I_CAL =
  "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z";
const I_USER =
  "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z";

// v18 wireframe 정보구조 — QR 큰 카드 / 오늘의 일정 / [예약 하기][마이 페이지]
// / 대표번호. 캘린더는 /me/calendar 로, 보유는 /me/holdings 로 분리.
export default async function CustomerHomePage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  const user = await requireGymCustomer(slug);
  const business = user.business!;
  const t = (await getTranslations("me")) as unknown as T;

  const todayMid = gymTodayUtcMidnight(business.timeZone);
  const todayEndMid = new Date(todayMid.getTime() + 24 * 60 * 60 * 1000);

  const [closureToday, todayReservations, accessQr, pendingRefunds] =
    await Promise.all([
      prisma.businessClosure.findFirst({
        where: { gymId: business.id, date: todayMid },
        select: { kind: true, reason: true },
      }),
      prisma.reservation.findMany({
        where: {
          gymId: business.id,
          customerUserId: user.id,
          startAt: { gte: todayMid, lt: todayEndMid },
          status: { notIn: ["CANCELLED", "REJECTED"] },
        },
        include: {
          service: { select: { name: true, capacity: true } },
          staff: { select: { user: { select: { name: true } } } },
        },
        orderBy: { startAt: "asc" },
      }),
      requestAccessQr(slug),
      // 본인 미지급 환불 — 매장 귀책(매장이 자동 생성) 만 공지 카드로 노출.
      // 회원 자발 환불은 회원이 이미 알기에 굳이 띄우지 않음.
      prisma.refundRequest.findMany({
        where: {
          gymId: business.id,
          userId: user.id,
          status: "PENDING",
          reason: { not: "CUSTOMER_REQUEST" },
        },
        select: {
          id: true,
          serviceName: true,
          refundPhp: true,
          refundUnits: true,
          kind: true,
          reason: true,
        },
        orderBy: { requestedAt: "desc" },
      }),
    ]);

  // v18 wireframe 형식 — "5월 20일 (화)" / "May 20 (Tue)". 짧고 두 칸 안에 들어감.
  const todayNoon = new Date(
    Date.UTC(
      todayMid.getUTCFullYear(),
      todayMid.getUTCMonth(),
      todayMid.getUTCDate(),
      12,
    ),
  );
  const todayWd = new Intl.DateTimeFormat(lang === "en" ? "en-US" : "ko-KR", {
    weekday: "short",
    timeZone: "UTC",
  }).format(todayNoon);
  const todayMonthDay = new Intl.DateTimeFormat(
    lang === "en" ? "en-US" : "ko-KR",
    { month: "long", day: "numeric", timeZone: "UTC" },
  ).format(todayNoon);
  const todayDateLabel = `${todayMonthDay} (${todayWd})`;

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-br from-orange-50 via-rose-50 to-amber-50 font-sans text-zinc-900">
      <div className="pointer-events-none absolute -top-24 left-1/3 h-[26rem] w-[26rem] rounded-full bg-orange-300/40 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 -right-10 h-[22rem] w-[22rem] rounded-full bg-rose-300/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 left-0 h-[20rem] w-[24rem] rounded-full bg-amber-300/30 blur-3xl" />

      <header className="relative px-5 pt-6 pb-3">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-500/80">
              {business.name}
            </div>
            <div className="mt-0.5 text-[26px] font-extrabold tracking-tight text-zinc-900">
              {user.name}
            </div>
          </div>
          <CustomerChatCard href={`/${lang}/g/${slug}/me/chat`} />
        </div>
      </header>

      <main className="relative flex-1">
        <div className="mx-auto w-full max-w-md space-y-4 px-5 pb-5">
          {closureToday && (
            <ClosureBanner
              reason={closureToday.reason}
              kindShortened={closureToday.kind === "SHORTENED"}
              t={t}
            />
          )}

          {pendingRefunds.length > 0 && (
            <RefundNoticeCard
              refunds={pendingRefunds}
              phone={business.phone}
              t={t}
            />
          )}

          <QrCard qr={accessQr} t={t} />

          <TodayHero
            reservations={todayReservations}
            lang={lang}
            dateLabel={todayDateLabel}
            t={t}
          />

          <section className="grid grid-cols-2 gap-3">
            <Link
              href={`/${lang}/g/${slug}/me/calendar`}
              className="relative flex min-h-[112px] flex-col justify-between overflow-hidden rounded-[24px] bg-gradient-to-br from-orange-500 to-rose-500 p-4 text-white shadow-[0_18px_44px_-16px_rgba(244,63,94,0.6)] active:scale-[0.98]"
            >
              <Icon d={I_CAL} className="opacity-90" />
              <div className="text-xl font-extrabold">{t("ctaBook")}</div>
              <span className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full bg-white/15" />
            </Link>
            <Link
              href={`/${lang}/g/${slug}/me/holdings`}
              className="flex min-h-[112px] flex-col justify-between rounded-[24px] bg-white/80 p-4 ring-1 ring-orange-200 backdrop-blur active:scale-[0.98]"
            >
              <Icon d={I_USER} className="text-orange-500" />
              <div className="text-xl font-extrabold text-zinc-900">
                {t("ctaMyPage")}
              </div>
            </Link>
          </section>
        </div>
      </main>

      <footer className="relative px-5 pb-6 pt-2">
        <div className="flex items-center justify-center gap-5 text-sm leading-none">
          {business.phone && (
            <div className="text-zinc-500">
              {t("frontDeskCall")}{" "}
              <a
                href={`tel:${business.phone}`}
                className="tabular-nums font-bold text-orange-600 underline-offset-2 hover:underline"
              >
                {business.phone}
              </a>
            </div>
          )}
          <form action={logout.bind(null, `/${lang}/g/${slug}/login`)}>
            <button className="text-sm leading-none text-zinc-400 hover:text-zinc-700">
              {t("logout")}
            </button>
          </form>
        </div>
      </footer>
    </div>
  );
}

function ClosureBanner({
  reason,
  kindShortened,
  t,
}: {
  reason: string | null;
  kindShortened: boolean;
  t: T;
}) {
  if (kindShortened) return null;
  return (
    <div className="rounded-[20px] bg-amber-50/80 p-4 ring-1 ring-amber-200 backdrop-blur">
      <div className="text-sm font-semibold tracking-tight text-amber-800">
        {t("closureTitle")}
      </div>
      {reason && (
        <div className="mt-1 text-xs text-amber-700/80">
          {t("closureReason", { reason })}
        </div>
      )}
    </div>
  );
}

type RefundNoticeItem = {
  id: string;
  serviceName: string;
  refundPhp: number;
  refundUnits: number;
  kind: "PACKAGE" | "MEMBERSHIP";
  reason:
    | "CUSTOMER_REQUEST"
    | "CLASS_DISCONTINUED"
    | "SERVICE_DISCONTINUED"
    | "STAFF_UNAVAILABLE";
};

// 매장 귀책 환불 알림 — 알림 인박스 시스템 미구축 동안 임시 카드 형태.
// 본문에 잔여·환불액 명시(영수증 역할) + 카운터 방문 안내.
function RefundNoticeCard({
  refunds,
  phone,
  t,
}: {
  refunds: RefundNoticeItem[];
  phone: string | null;
  t: T;
}) {
  const total = refunds.reduce((sum, r) => sum + r.refundPhp, 0);
  return (
    <section className="rounded-[20px] bg-amber-50/80 p-4 ring-1 ring-amber-200 backdrop-blur">
      <div className="text-sm font-semibold tracking-tight text-amber-800">
        {t("refundNoticeTitle")}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-amber-900/80">
        {t("refundNoticeBody")}
      </p>
      <ul className="mt-3 space-y-1.5">
        {refunds.map((r) => (
          <li
            key={r.id}
            className="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-3 rounded-xl bg-white/70 px-3 py-2 text-xs ring-1 ring-amber-100"
          >
            <span className="truncate font-medium text-zinc-900">
              {r.serviceName}
            </span>
            <span className="tabular-nums text-zinc-600">
              {t("refundNoticeRemaining", { n: r.refundUnits })}
            </span>
            <span className="tabular-nums font-semibold text-orange-700">
              {money(r.refundPhp)}
            </span>
          </li>
        ))}
      </ul>
      {refunds.length > 1 && (
        <div className="mt-2 flex items-baseline justify-end gap-2 text-xs">
          <span className="text-amber-900/70">
            {t("refundNoticeTotalLabel")}
          </span>
          <span className="tabular-nums font-bold text-orange-700">
            {money(total)}
          </span>
        </div>
      )}
      <div className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-100">
        {t("refundNoticeVisit")}
        {phone && (
          <>
            {" "}
            <a
              href={`tel:${phone}`}
              className="font-medium text-orange-700 underline-offset-2 hover:underline"
            >
              {phone}
            </a>
          </>
        )}
      </div>
    </section>
  );
}

function money(php: number): string {
  return `₱${php.toLocaleString("en-PH")}`;
}

// 출입 QR — 유리감 카드 + 라벨 + 그라데 프레임. 스캔 거리 위해 QR 크게.
function QrCard({ qr, t }: { qr: AccessQrResult; t: T }) {
  return (
    <section className="rounded-[26px] bg-white/70 p-4 shadow-[0_24px_60px_-28px_rgba(249,115,22,0.55)] ring-1 ring-white/80 backdrop-blur-xl">
      {qr.ok ? (
        <>
          <div className="mb-3 flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-orange-500/80">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
            {t("qrLabel")}
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-orange-100 to-rose-100 p-3">
            <div className="rounded-xl bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qr.qr}
                alt="Access QR"
                className="mx-auto block aspect-square w-full max-w-[15rem]"
              />
            </div>
          </div>
        </>
      ) : qr.reason === "blocked" ? (
        <div className="py-4 text-center">
          <div className="text-sm font-semibold tracking-tight text-rose-700">
            {t("qrBlockedTitle")}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-zinc-600">
            {t("qrBlockedBody")}
          </p>
        </div>
      ) : (
        <div className="py-4 text-center">
          <div className="text-sm font-semibold tracking-tight text-amber-700">
            {t("qrNoAccessTitle")}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-zinc-600">
            {t("qrNoAccessBody")}
          </p>
        </div>
      )}
    </section>
  );
}

type TodayReservation = {
  id: string;
  startAt: Date;
  scheduledClassId: string | null;
  status: string;
  service: { name: string; capacity: number };
  staff: { user: { name: string } };
};

function TodayHero({
  reservations,
  lang,
  dateLabel,
  t,
}: {
  reservations: TodayReservation[];
  lang: string;
  dateLabel: string;
  t: T;
}) {
  return (
    <section className="rounded-[26px] bg-white/70 p-4 shadow-[0_24px_60px_-30px_rgba(249,115,22,0.45)] ring-1 ring-white/80 backdrop-blur-xl">
      <div className="flex items-baseline justify-between px-1">
        <h3 className="text-base font-extrabold text-zinc-900">
          {t("todayTitle")}
        </h3>
        <span className="text-xs font-medium text-orange-500/80">
          {dateLabel}
        </span>
      </div>
      {reservations.length === 0 ? (
        <div className="mt-3 rounded-2xl bg-white/60 p-4 text-center text-sm text-zinc-500 ring-1 ring-black/5">
          {t("todayEmpty")}
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {reservations.map((r) => {
            const isGroup =
              r.scheduledClassId !== null || r.service.capacity !== 1;
            const done = r.status === "COMPLETED";
            const time = formatTime(r.startAt, lang);
            // 시간(맨 앞, 크게) - 서비스명(가운데, 한 줄) - 트레이너(맨 끝).
            // 좌측 막대/아이콘 없음, 2줄 처리 없음. 상태색은 칩 배경 + 시간/트레이너 글자.
            const tint = done
              ? "bg-emerald-50"
              : isGroup
                ? "bg-amber-50"
                : "bg-orange-50";
            const accent = done
              ? "text-emerald-700"
              : isGroup
                ? "text-amber-700"
                : "text-orange-700";
            return (
              <li
                key={r.id}
                className={
                  "flex items-center gap-3 rounded-2xl p-3 ring-1 ring-black/5 " +
                  tint
                }
              >
                <span
                  className={
                    "shrink-0 text-3xl font-bold tabular-nums " + accent
                  }
                >
                  {time}
                </span>
                <span className="min-w-0 flex-1 truncate text-lg font-semibold text-zinc-800">
                  {done && "✓ "}
                  {r.service.name}
                </span>
                <span
                  className={"shrink-0 text-base font-semibold " + accent}
                >
                  {r.staff.user.name}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// startAt 은 UTC-naive(Manila 벽시계 = UTC 파츠)라 timeZone 변환 없이 UTC 로 읽음.
function formatTime(d: Date, lang: string): string {
  return new Intl.DateTimeFormat(lang === "en" ? "en-US" : "ko-KR", {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}
