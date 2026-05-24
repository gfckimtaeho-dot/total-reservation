import type { Viewport } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { logout } from "@/lib/auth/actions";
import { requireGymCustomer } from "@/lib/auth/dal";
import { prisma } from "@/lib/db/client";
import { gymTodayUtcMidnight } from "@/lib/calendar/gymTime";
import { requestAccessQr, type AccessQrResult } from "./actions";

type T = (key: string, vars?: Record<string, string | number>) => string;

// V18 Sunset Peach 채택 — 화이트 + 오렌지/로즈/앰버. 모바일 상태바도 흰색 매칭.
// 부모 [lang]/layout.tsx 의 themeColor(#000)를 이 페이지에서만 override.
export const viewport: Viewport = {
  themeColor: "#ffffff",
};

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
  const todayWd = new Intl.DateTimeFormat(
    lang === "en" ? "en-US" : "ko-KR",
    { weekday: "short", timeZone: "UTC" },
  ).format(todayNoon);
  const todayMonthDay = new Intl.DateTimeFormat(
    lang === "en" ? "en-US" : "ko-KR",
    { month: "long", day: "numeric", timeZone: "UTC" },
  ).format(todayNoon);
  const todayDateLabel = `${todayMonthDay} (${todayWd})`;

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-br from-orange-50 via-rose-50 to-amber-50 font-sans text-zinc-900">
      <div className="pointer-events-none absolute -top-32 left-1/4 h-[28rem] w-[28rem] rounded-full bg-orange-200/60 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 right-0 h-[24rem] w-[28rem] rounded-full bg-rose-200/50 blur-3xl" />

      <header className="relative border-b border-orange-100">
        <div className="mx-auto max-w-md px-5 py-4">
          <div className="min-w-0">
            <div className="text-sm font-medium text-orange-600">
              {business.name}
            </div>
            <div className="mt-0.5 text-2xl font-bold tracking-tight text-zinc-900">
              {user.name}
            </div>
          </div>
        </div>
      </header>

      <main className="relative flex-1">
        <div className="mx-auto w-full max-w-md space-y-5 px-5 py-5">
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
              className="flex min-h-[112px] items-center justify-center rounded-3xl bg-gradient-to-br from-orange-500 to-rose-500 p-5 text-white shadow-[0_15px_40px_-15px_rgba(249,115,22,0.55)] active:scale-[0.98]"
            >
              <div className="text-xl font-bold">{t("ctaBook")}</div>
            </Link>
            <Link
              href={`/${lang}/g/${slug}/me/holdings`}
              className="flex min-h-[112px] items-center justify-center rounded-3xl border-2 border-orange-200 bg-white p-5 text-zinc-900 active:scale-[0.98]"
            >
              <div className="text-xl font-bold">{t("ctaMyPage")}</div>
            </Link>
          </section>
        </div>
      </main>

      <footer className="relative border-t border-orange-100 bg-white/60 py-5 backdrop-blur">
        {/* 좌측 대표번호 / 우측 logout — 두 요소 같은 줄, leading 통일로
            baseline 어긋남 방지. */}
        <div className="flex items-center justify-center gap-5 text-base leading-none">
          {business.phone && (
            <div className="text-zinc-600">
              {t("frontDeskCall")}{" "}
              <a
                href={`tel:${business.phone}`}
                className="tabular-nums font-medium text-orange-600 underline-offset-2 hover:underline"
              >
                {business.phone}
              </a>
            </div>
          )}
          <form action={logout.bind(null, `/${lang}/g/${slug}/login`)}>
            <button className="text-base leading-none text-zinc-500 hover:text-zinc-900">
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
    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
      <div className="font-heading text-sm tracking-tight text-amber-700">
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
// 본문에 잔여·환불액 명시(영수증 역할) + 카운터 방문 안내. 사장이 /refunds
// 에서 "지급 완료(카운터)" 처리하면 status=COMPLETED 로 자동 사라짐.
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
    <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
      <div className="font-heading text-sm tracking-tight text-amber-800">
        {t("refundNoticeTitle")}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-amber-900/80">
        {t("refundNoticeBody")}
      </p>
      <ul className="mt-3 space-y-1.5">
        {refunds.map((r) => (
          <li
            key={r.id}
            className="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-3 rounded-lg bg-white/60 px-3 py-2 text-xs"
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
      <div className="mt-3 rounded-lg bg-white/60 px-3 py-2 text-xs text-amber-900">
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

// v18 시안 사이즈 그대로 — 컨테이너 14.5rem · QR 7.25rem. 사용자명/qrHint 는
// wireframe 에 없고 사용자 제거 지시. 유효기간만 표시.
function QrCard({ qr, t }: { qr: AccessQrResult; t: T }) {
  return (
    <section className="rounded-3xl border border-orange-200/60 bg-white/90 p-5 shadow-[0_30px_80px_-30px_rgba(249,115,22,0.4)] backdrop-blur">
      {qr.ok ? (
        <div className="mx-auto w-full max-w-[14.5rem]">
          <div className="mx-auto w-[10rem] rounded-2xl bg-gradient-to-br from-orange-50 to-rose-50 p-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qr.qr}
              alt="Access QR"
              className="block aspect-square w-full"
            />
          </div>
          <div className="mt-5 text-center text-base font-semibold tabular-nums text-orange-600">
            {t("qrExpires", { date: qr.expiresYmd })}
          </div>
        </div>
      ) : qr.reason === "blocked" ? (
        <div className="py-2 text-center">
          <div className="font-heading text-sm tracking-tight text-rose-700">
            {t("qrBlockedTitle")}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-zinc-600">
            {t("qrBlockedBody")}
          </p>
        </div>
      ) : (
        <div className="py-2 text-center">
          <div className="font-heading text-sm tracking-tight text-amber-700">
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
    <section className="relative overflow-hidden rounded-3xl border border-orange-200/60 bg-white/90 p-5 backdrop-blur">
      <div className="flex items-baseline justify-between px-3">
        <h3 className="text-lg font-bold text-orange-600">
          {t("todayTitle")}
        </h3>
        <span className="text-base text-zinc-500">{dateLabel}</span>
      </div>
      {reservations.length === 0 ? (
        <div className="mt-3 rounded-2xl bg-zinc-50 p-4 text-center text-sm text-zinc-500">
          {t("todayEmpty")}
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {reservations.map((r) => {
            const isGroup =
              r.scheduledClassId !== null || r.service.capacity !== 1;
            const done = r.status === "COMPLETED";
            const time = formatTime(r.startAt, lang);
            const trainerLabel = "Tr";
            // v18 시안 row 그대로 — grid 3열 [시간 좌 3xl][서비스 중 2xl][트레이너 우 컬럼].
            // 사용자 변경: 트레이너 컬럼 내부 정렬 text-right → text-left, 트레이너
            // 이름 폰트 base → xl(좀 더 크게). 라벨("Tr"/"트레이너")은 그대로 작게.
            const rowCls = done
              ? "bg-emerald-100"
              : isGroup
                ? "bg-amber-100"
                : "bg-gradient-to-r from-orange-200 to-rose-200";
            const timeCls = done
              ? "text-emerald-800"
              : isGroup
                ? "text-amber-800"
                : "text-orange-800";
            const trainerNameCls = done
              ? "text-emerald-700"
              : isGroup
                ? "text-amber-700"
                : "text-orange-700";
            return (
              <li key={r.id}>
                <div
                  className={
                    "grid grid-cols-3 items-baseline gap-2 rounded-2xl p-3 " +
                    rowCls
                  }
                >
                  <div
                    className={
                      "text-left text-3xl font-bold tabular-nums " + timeCls
                    }
                  >
                    {time}
                  </div>
                  <div className="truncate text-center text-2xl font-bold text-zinc-900">
                    {done && "✓ "}
                    {r.service.name}
                  </div>
                  <div className="text-left text-xs">
                    <span
                      className={"text-xl font-semibold " + trainerNameCls}
                    >
                      {r.staff.user.name}
                    </span>{" "}
                    <span className="text-zinc-600">{trainerLabel}</span>
                  </div>
                </div>
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
