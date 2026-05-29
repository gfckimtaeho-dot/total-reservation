import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { hotelDb } from "@/lib/hotel-db";
import type { BusinessStatus } from "@/generated/prisma/client";
import { VerticalLabel } from "../../invites/PendingInviteRow";
import { BlockForm } from "./BlockForm";
import { PasswordResetSendForm } from "./PasswordResetSendForm";
import { OwnerContactForm } from "./OwnerContactForm";
import { AffiliationManager } from "./AffiliationManager";

const dateFmt = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
});

function fmt(d: Date | null | undefined): string {
  if (!d) return "-";
  return dateFmt.format(d);
}

const STATUS_LABEL: Record<BusinessStatus, string> = {
  TRIAL: "체험중",
  ACTIVE: "정상",
  GRACE: "유예",
  EXPIRED: "만료",
  BLOCKED: "차단",
};

const STATUS_CHIP: Record<BusinessStatus, string> = {
  TRIAL: "bg-sky-50 text-sky-700 ring-sky-200",
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  GRACE: "bg-amber-50 text-amber-700 ring-amber-200",
  EXPIRED: "bg-zinc-100 text-zinc-600 ring-zinc-300",
  BLOCKED: "bg-rose-50 text-rose-700 ring-rose-200",
};

type Vertical = "GYM" | "HOTEL";

type OwnerView = {
  id: string;
  loginId: string | null;
  email: string | null;
  name: string;
  phone: string | null;
};

type SubscriptionView = {
  plan: string;
  startDate: Date;
  endDate: Date;
};

type GymExtras = {
  category: string;
  hasDeposit: boolean;
  cityName: string | null;
  barangayName: string | null;
};

type HotelExtras = {
  address: string | null;
  taxRegistrationNumber: string | null;
  taxLegalName: string | null;
  taxAddress: string | null;
  taxBusinessType: string | null;
  defaultCheckInMin: number;
  defaultCheckOutMin: number;
};

type DetailView = {
  id: string;
  vertical: Vertical;
  name: string;
  slug: string;
  phone: string | null;
  contactEmail: string | null;
  status: BusinessStatus;
  blockedReason: string | null;
  timeZone: string;
  createdAt: Date;
  updatedAt: Date;
  owner: OwnerView | null;
  subscription: SubscriptionView | null;
  gym?: GymExtras;
  hotel?: HotelExtras;
};

function minToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default async function AdminBusinessDetailPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;

  // 헬스장 먼저 try, 없으면 호텔 fallback.
  const gymRow = await prisma.business.findUnique({
    where: { id },
    include: {
      users: {
        where: { role: "OWNER" },
        select: {
          id: true,
          loginId: true,
          email: true,
          name: true,
          phone: true,
        },
        take: 1,
      },
      subscription: true,
      city: { select: { name: true } },
      barangay: { select: { name: true } },
    },
  });

  let view: DetailView | null = null;
  if (gymRow) {
    view = {
      id: gymRow.id,
      vertical: "GYM",
      name: gymRow.name,
      slug: gymRow.slug,
      phone: gymRow.phone,
      contactEmail: gymRow.contactEmail,
      status: gymRow.status as BusinessStatus,
      blockedReason: gymRow.blockedReason,
      timeZone: gymRow.timeZone,
      createdAt: gymRow.createdAt,
      updatedAt: gymRow.updatedAt,
      owner: gymRow.users[0]
        ? {
            id: gymRow.users[0].id,
            loginId: gymRow.users[0].loginId,
            email: gymRow.users[0].email,
            name: gymRow.users[0].name,
            phone: gymRow.users[0].phone,
          }
        : null,
      subscription: gymRow.subscription
        ? {
            plan: gymRow.subscription.plan,
            startDate: gymRow.subscription.startDate,
            endDate: gymRow.subscription.endDate,
          }
        : null,
      gym: {
        category: gymRow.category,
        hasDeposit: gymRow.hasDeposit,
        cityName: gymRow.city?.name ?? null,
        barangayName: gymRow.barangay?.name ?? null,
      },
    };
  } else {
    const hotelRow = await hotelDb.business.findUnique({
      where: { id },
      include: {
        users: {
          where: { role: "OWNER" },
          select: {
            id: true,
            loginId: true,
            email: true,
            name: true,
            phone: true,
          },
          take: 1,
        },
        subscription: true,
      },
    });
    if (hotelRow) {
      view = {
        id: hotelRow.id,
        vertical: "HOTEL",
        name: hotelRow.name,
        slug: hotelRow.slug,
        phone: hotelRow.phone,
        contactEmail: hotelRow.contactEmail,
        status: hotelRow.status as BusinessStatus,
        blockedReason: hotelRow.blockedReason,
        timeZone: hotelRow.timeZone,
        createdAt: hotelRow.createdAt,
        updatedAt: hotelRow.updatedAt,
        owner: hotelRow.users[0]
          ? {
              id: hotelRow.users[0].id,
              loginId: hotelRow.users[0].loginId,
              email: hotelRow.users[0].email,
              name: hotelRow.users[0].name,
              phone: hotelRow.users[0].phone,
            }
          : null,
        subscription: hotelRow.subscription
          ? {
              plan: hotelRow.subscription.plan,
              startDate: hotelRow.subscription.startDate,
              endDate: hotelRow.subscription.endDate,
            }
          : null,
        hotel: {
          address: hotelRow.address,
          taxRegistrationNumber: hotelRow.taxRegistrationNumber,
          taxLegalName: hotelRow.taxLegalName,
          taxAddress: hotelRow.taxAddress,
          taxBusinessType: hotelRow.taxBusinessType,
          defaultCheckInMin: hotelRow.defaultCheckInMin,
          defaultCheckOutMin: hotelRow.defaultCheckOutMin,
        },
      };
    }
  }

  if (!view) notFound();

  const owner = view.owner;
  const isHotel = view.vertical === "HOTEL";

  // 게스트 출입 제휴 (GYM 만). 현재 제휴 목록 + 추가 가능한 호텔 목록(cross-DB).
  let affiliations: {
    id: string;
    hotelId: string;
    hotelName: string | null;
    active: boolean;
  }[] = [];
  let availableHotels: {
    id: string;
    name: string;
    slug: string;
    status: string;
  }[] = [];
  if (view.gym) {
    const [affRows, hotelRows] = await Promise.all([
      prisma.gymHotelAffiliation.findMany({
        where: { gymId: view.id },
        orderBy: { createdAt: "asc" },
        select: { id: true, hotelId: true, hotelName: true, active: true },
      }),
      hotelDb.business.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, slug: true, status: true },
      }),
    ]);
    // 호텔명은 live 값으로 갱신 표시(스냅샷 stale 방지).
    const liveName = new Map(hotelRows.map((h) => [h.id, h.name]));
    affiliations = affRows.map((a) => ({
      ...a,
      hotelName: liveName.get(a.hotelId) ?? a.hotelName,
    }));
    const affiliatedIds = new Set(affRows.map((a) => a.hotelId));
    availableHotels = hotelRows.filter((h) => !affiliatedIds.has(h.id));
  }
  const passwordResetSlot = (
    <PasswordResetSendForm
      businessId={view.id}
      vertical={view.vertical}
      ownerName={owner?.name ?? null}
      ownerEmail={owner?.email ?? null}
      storeName={view.name}
    />
  );

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={`/${lang}/admin/businesses`}
          className="text-xs text-zinc-600 transition hover:text-ink"
        >
          &lt; 가맹점 목록
        </Link>
      </div>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-3xl tracking-tight text-ink sm:text-4xl">
            {view.name}
          </h1>
          <VerticalLabel vertical={view.vertical} />
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ring-1 ${STATUS_CHIP[view.status]}`}
          >
            {STATUS_LABEL[view.status]}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-600">
          {view.gym ? (
            <Link
              href={`/${lang}/g/${view.slug}`}
              className="font-mono text-zinc-700 underline-offset-2 hover:underline"
            >
              /{view.slug}
            </Link>
          ) : (
            <span className="font-mono text-zinc-700">/{view.slug}</span>
          )}
          {view.gym && <span>· {view.gym.category}</span>}
          <span>· {view.timeZone}</span>
          {view.gym?.cityName && (
            <span>
              · {view.gym.cityName} {view.gym.barangayName ?? ""}
            </span>
          )}
          {view.hotel?.address && <span>· {view.hotel.address}</span>}
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {owner ? (
          <OwnerContactForm
            businessId={view.id}
            vertical={view.vertical}
            ownerId={owner.id}
            name={owner.name}
            loginId={owner.loginId}
            initialEmail={owner.email}
            initialPhone={owner.phone}
          />
        ) : (
          <InfoCard label="사장">
            <Row k="이름" v="-" />
            <Row k="loginId" v="-" mono />
            <Row k="email" v="-" mono />
            <Row k="전화" v="-" mono />
          </InfoCard>
        )}

        <InfoCard label="구독">
          <Row k="plan" v={view.subscription?.plan ?? "-"} />
          <Row
            k="시작"
            v={
              view.subscription?.startDate
                ? fmt(view.subscription.startDate)
                : "-"
            }
          />
          <Row
            k="만료"
            v={
              view.subscription?.endDate ? fmt(view.subscription.endDate) : "-"
            }
          />
        </InfoCard>

        <InfoCard label="매장">
          <Row k="phone" v={view.phone ?? "-"} mono />
          <Row k="contactEmail" v={view.contactEmail ?? "-"} mono />
          {view.gym && (
            <Row k="입금" v={view.gym.hasDeposit ? "사용" : "미사용"} />
          )}
          {view.hotel && (
            <>
              <Row
                k="체크인"
                v={minToHHMM(view.hotel.defaultCheckInMin)}
                mono
              />
              <Row
                k="체크아웃"
                v={minToHHMM(view.hotel.defaultCheckOutMin)}
                mono
              />
            </>
          )}
          <Row k="가입" v={fmt(view.createdAt)} />
          <Row k="최근 수정" v={fmt(view.updatedAt)} />
        </InfoCard>

        {isHotel && view.hotel ? (
          <InfoCard label="사업자 정보 (세금계산서 발행용)">
            <Row k="사업자번호" v={view.hotel.taxRegistrationNumber ?? "-"} mono />
            <Row k="상호" v={view.hotel.taxLegalName ?? "-"} />
            <Row k="사업장 주소" v={view.hotel.taxAddress ?? "-"} />
            <Row k="업태/종목" v={view.hotel.taxBusinessType ?? "-"} />
          </InfoCard>
        ) : (
          <div className="sm:row-span-2">
            <BlockForm
              businessId={view.id}
              vertical={view.vertical}
              status={view.status}
              blockedReason={view.blockedReason}
              passwordResetSlot={passwordResetSlot}
            />
          </div>
        )}

        {isHotel && (
          <div className="sm:col-span-2">
            <BlockForm
              businessId={view.id}
              vertical={view.vertical}
              status={view.status}
              blockedReason={view.blockedReason}
              passwordResetSlot={passwordResetSlot}
            />
          </div>
        )}
      </section>

      {view.gym && (
        <section>
          <AffiliationManager
            gymId={view.id}
            affiliations={affiliations}
            availableHotels={availableHotels}
          />
        </section>
      )}
    </div>
  );
}

function InfoCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-ink/60">
        {label}
      </div>
      <dl className="space-y-1.5">{children}</dl>
    </div>
  );
}

function Row({
  k,
  v,
  mono,
}: {
  k: string;
  v: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <dt className="text-xs text-zinc-500">{k}</dt>
      <dd
        className={`min-w-0 truncate text-right text-zinc-900 ${
          mono ? "font-mono text-xs" : ""
        }`}
      >
        {v}
      </dd>
    </div>
  );
}
