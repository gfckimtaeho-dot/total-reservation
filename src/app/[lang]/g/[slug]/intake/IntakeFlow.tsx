"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { createMember } from "../members/actions";
import {
  listRecentCustomers,
  listMyAssignedCustomers,
  issueCart,
} from "../dashboard/service-actions";
import {
  pickBestPromo,
  type PromoLike,
} from "@/lib/catalog/promo";

type Membership = {
  id: string;
  name: string;
  pricePhp: number;
  durationDays: number;
};
type Pkg = {
  id: string;
  name: string;
  pricePhp: number;
  sessionCount: number;
  serviceName: string;
};
type Combo = {
  id: string;
  name: string;
  pricePhp: number;
  parts: string[];
};
type Cust = {
  id: string;
  name: string;
  phone?: string | null;
  services?: { name: string; isGroup: boolean; remaining: number }[];
};

export function IntakeFlow({
  slug,
  lang,
  preset,
  memberships,
  packages,
  combos,
  promotions,
  embedded = false,
}: {
  slug: string;
  lang: string;
  preset: { id: string; name: string } | null;
  memberships: Membership[];
  packages: Pkg[];
  combos: Combo[];
  promotions: PromoLike[];
  // embedded=true: 사장 dashboard chrome 안에 임베드(헤더/back link/outer bg 제거).
  // 트레이너는 dashboard 자체가 풀스크린이라 embedded=false로 outer 자체 chrome.
  embedded?: boolean;
}) {
  const t = useTranslations("trainerCal");
  const [pending, start] = useTransition();
  const [cust, setCust] = useState<Cust | null>(preset);
  const [tab, setTab] = useState<"existing" | "new">("existing");
  const [cat, setCat] = useState<"membership" | "package" | "combo">(
    "membership",
  );
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Cust[]>([]);
  const [searched, setSearched] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const PAGE = 10;
  // "2. 내 담당 고객" 섹션 state (embedded=false, 즉 트레이너 풀스크린 일 때만 의미)
  const [myResults, setMyResults] = useState<Cust[]>([]);
  const [myHasMore, setMyHasMore] = useState(false);
  const [myOffset, setMyOffset] = useState(0);
  const [myLoading, setMyLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [issuedN, setIssuedN] = useState(0);

  // 즉석 장바구니 — 회원권/횟수권/콤보를 여러 건 담아 한 번에 발급.
  // 라인마다 독립 Sale 1행으로 서버에서 한 트랜잭션 처리(issueCart).
  type CartLine = {
    uid: string;
    kind: "MEMBERSHIP" | "PACKAGE" | "COMBO";
    planId: string;
    name: string;
    pricePhp: number;
  };
  const [cart, setCart] = useState<CartLine[]>([]);
  // uid 는 리스트 key·삭제용일 뿐(암호화 불필요). HTTP+LAN IP 태블릿은
  // secure context 가 아니라 crypto.randomUUID 가 없어 throw → 단순 카운터.
  const uidRef = useRef(0);
  // 라인 할인(미리보기) — 서버 발급과 동일한 @/lib/catalog/promo 산식.
  // 콤보는 프로모션 대상 아님(번들가 그대로).
  function lineDiscount(l: CartLine): number {
    if (l.kind === "COMBO") return 0;
    const b = pickBestPromo(promotions, l.kind, l.planId, l.pricePhp);
    return b?.discountPhp ?? 0;
  }
  const cartListTotal = cart.reduce((s, l) => s + l.pricePhp, 0);
  const cartTotal = cart.reduce(
    (s, l) => s + l.pricePhp - lineDiscount(l),
    0,
  );
  const cartSaved = cartListTotal - cartTotal;
  function addToCart(line: Omit<CartLine, "uid">) {
    setErr(null);
    uidRef.current += 1;
    const uid = `c${uidRef.current}`;
    setCart((c) => [...c, { ...line, uid }]);
  }
  function removeFromCart(uid: string) {
    setCart((c) => c.filter((x) => x.uid !== uid));
  }
  function doIssueCart() {
    if (!cust || cart.length === 0) return;
    setErr(null);
    start(async () => {
      const r = await issueCart({
        slug,
        customerUserId: cust.id,
        items: cart.map(({ kind, planId }) => ({ kind, planId })),
      });
      if (r.ok) {
        setIssuedN(cart.length);
        setCart([]);
        setDone(true);
      } else setErr(r.error || t("actionFailed"));
    });
  }

  // 신규 등록 폼 (사장님 createMember 와 동일 필드)
  const [f, setF] = useState({
    name: "",
    phone: "",
    email: "",
    gender: "MALE",
    dob: "",
    emergencyContactPhone: "",
    note: "",
  });

  const peso = (n: number) => `₱${n.toLocaleString()}`;

  function doSearch() {
    const term = q.trim();
    start(async () => {
      const r = await listRecentCustomers({
        slug,
        q: term,
        limit: PAGE,
        offset: 0,
      });
      setSearched(true);
      if (r.ok) {
        const d = r.data as { rows: Cust[]; hasMore: boolean };
        setResults(d.rows);
        setHasMore(d.hasMore);
        setOffset(0);
      } else {
        setResults([]);
        setHasMore(false);
      }
    });
  }

  function loadMore() {
    const term = q.trim();
    const next = offset + PAGE;
    start(async () => {
      const r = await listRecentCustomers({
        slug,
        q: term,
        limit: PAGE,
        offset: next,
      });
      if (r.ok) {
        const d = r.data as { rows: Cust[]; hasMore: boolean };
        setResults((prev) => [...prev, ...d.rows]);
        setHasMore(d.hasMore);
        setOffset(next);
      }
    });
  }

  function loadMoreMy() {
    const next = myOffset + PAGE;
    setMyLoading(true);
    (async () => {
      const r = await listMyAssignedCustomers({
        slug,
        limit: PAGE,
        offset: next,
      });
      if (r.ok) {
        const d = r.data as { rows: Cust[]; hasMore: boolean };
        setMyResults((prev) => [...prev, ...d.rows]);
        setMyHasMore(d.hasMore);
        setMyOffset(next);
      }
      setMyLoading(false);
    })();
  }

  // 트레이너 풀스크린(embedded=false) 일 때만 "내 담당 고객" mount-load.
  useEffect(() => {
    if (embedded) return;
    setMyLoading(true);
    (async () => {
      const r = await listMyAssignedCustomers({
        slug,
        limit: PAGE,
        offset: 0,
      });
      if (r.ok) {
        const d = r.data as { rows: Cust[]; hasMore: boolean };
        setMyResults(d.rows);
        setMyHasMore(d.hasMore);
        setMyOffset(0);
      }
      setMyLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedded, slug]);

  // q 변경 시 자동 로드 — 빈 q 도 첫 페이지(최근 등록 순) 표시.
  // 빈 입력은 즉시(=초기 list 노출), 검색어는 300ms 디바운스.
  useEffect(() => {
    const term = q.trim();
    const delay = term.length === 0 ? 0 : 300;
    const id = setTimeout(() => {
      start(async () => {
        const r = await listRecentCustomers({
          slug,
          q: term,
          limit: PAGE,
          offset: 0,
        });
        setSearched(true);
        if (r.ok) {
          const d = r.data as { rows: Cust[]; hasMore: boolean };
          setResults(d.rows);
          setHasMore(d.hasMore);
          setOffset(0);
        } else {
          setResults([]);
          setHasMore(false);
        }
      });
    }, delay);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, slug]);

  function doCreate() {
    setErr(null);
    start(async () => {
      const fd = new FormData();
      fd.set("slug", slug);
      fd.set("name", f.name);
      fd.set("phone", f.phone);
      fd.set("email", f.email);
      fd.set("gender", f.gender);
      fd.set("dob", f.dob);
      fd.set("emergencyContactPhone", f.emergencyContactPhone);
      fd.set("note", f.note);
      const r = await createMember({}, fd);
      if (r.success) {
        setCust({ id: r.success.id, name: f.name });
      } else {
        const e = r.errors
          ? Object.values(r.errors).flat().filter(Boolean)[0]
          : null;
        setErr((e as string) || t("actionFailed"));
      }
    });
  }

  const field =
    "w-full rounded-md border border-white/15 bg-zinc-950 px-3.5 py-3 text-lg";
  const tabBtn = (on: boolean) =>
    `rounded-md px-4 py-2.5 text-lg font-medium transition ${
      on
        ? "bg-amber-400 text-zinc-950"
        : "border border-white/15 text-zinc-300 hover:bg-white/5"
    }`;

  // 고객 row 렌더 — 이름/연락처 + 보유 서비스 chip(잔여>0). 두 list 공용.
  function renderCustRow(c: Cust) {
    return (
      <button
        type="button"
        onClick={() => setCust({ id: c.id, name: c.name })}
        className="flex w-full flex-col gap-1.5 rounded-md border border-white/15 px-4 py-3.5 text-left hover:border-amber-400/50 hover:bg-amber-400/10"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-lg font-semibold text-white">{c.name}</span>
          <span className="text-base tabular-nums text-zinc-400">
            {c.phone ?? ""}
          </span>
        </div>
        {c.services && c.services.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {c.services.map((s, i) => {
              const remainStr =
                s.remaining % 1 === 0
                  ? String(s.remaining)
                  : s.remaining.toFixed(1);
              const unit = lang === "en" ? "" : "회";
              const groupLabel = lang === "en" ? "Group " : "단체 ";
              const text = `${s.isGroup ? groupLabel : ""}${s.name} ${remainStr}${unit}`;
              return (
                <span
                  key={i}
                  className={
                    "rounded-full px-2 py-0.5 text-xs tabular-nums " +
                    (s.isGroup
                      ? "bg-purple-500/15 text-purple-200 ring-1 ring-purple-400/30"
                      : "bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/30")
                  }
                >
                  {text}
                </span>
              );
            })}
          </div>
        )}
      </button>
    );
  }

  const outerCls = embedded
    ? "p-4 text-zinc-100"
    : "min-h-[100dvh] bg-black p-4 text-zinc-100";

  return (
    <div className={outerCls}>
      <div className="mx-auto max-w-xl pb-28 lg:max-w-5xl lg:pb-0">
        {!embedded && (
          <div className="flex items-center justify-between">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-white">
              {t("intakeTitle")}
            </h1>
            <Link
              href={`/${lang}/g/${slug}/dashboard`}
              className="rounded-md border border-white/15 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-white/5"
            >
              ← {t("goDashboard")}
            </Link>
          </div>
        )}

        {err && <p className="mt-3 text-sm text-rose-400">{err}</p>}

        {done ? (
          <div className="mt-6 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-6 text-center">
            <p className="text-lg font-semibold text-emerald-300">
              ✓ {t("issuedCount", { count: issuedN })}
            </p>
            <p className="mt-1 text-sm text-zinc-300">{cust?.name}</p>
            <div className="mt-5 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => setDone(false)}
                className="rounded-md border border-amber-400/40 bg-amber-400/10 px-4 py-2 text-sm text-amber-300"
              >
                {t("issueAnother")}
              </button>
              {!embedded && (
                <Link
                  href={`/${lang}/g/${slug}/dashboard`}
                  className="rounded-md border border-white/15 px-4 py-2 text-sm text-zinc-300"
                >
                  {t("goDashboard")}
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-4 lg:grid lg:grid-cols-[1fr_340px] lg:items-start lg:gap-4">
            <div className="space-y-4">
            {/* 선택된 고객 banner — 우측 장바구니 카드와 lg 화면에서
                같은 외곽선 높이가 되도록 lg:min-h-[120px] 강제 + 콘텐츠
                중앙 정렬. 자연 높이 차이 (선택고객 1줄 vs 장바구니 비어있을
                때 h2+empty 2줄)를 강제로 흡수. */}
            {!embedded && cust && (
              <div className="flex items-center justify-between rounded-2xl border border-amber-400/25 bg-zinc-900 p-3 lg:min-h-[80px]">
                <span>
                  <span className="text-base font-semibold uppercase tracking-[0.14em] text-amber-300/90">
                    {t("pickedCustomer")}
                  </span>
                  <span className="ml-3 text-3xl font-bold text-white">
                    {cust.name}
                  </span>
                </span>
                {!preset && (
                  <button
                    type="button"
                    onClick={() => setCust(null)}
                    className="rounded-md border border-white/15 px-3.5 py-2 text-sm font-medium text-zinc-300 hover:bg-white/5"
                  >
                    {t("changeCustomer")}
                  </button>
                )}
              </div>
            )}

            {/* 1. 내 담당 고객 — 본인이 담당 트레이너로 발급된 권의 고객들. 트레이너 전용. */}
            {!embedded && !cust && (
              <section className="rounded-2xl border border-amber-400/25 bg-zinc-900 p-4">
                <h2 className="text-base font-semibold uppercase tracking-[0.14em] text-amber-300/90">
                  {t("stepMyCustomers")}
                </h2>
                <ul className="mt-3 space-y-2">
                  {myLoading && myResults.length === 0 && (
                    <li className="px-1 py-3 text-base text-zinc-500">
                      {t("searchTyping")}
                    </li>
                  )}
                  {!myLoading && myResults.length === 0 && (
                    <li className="px-1 py-3 text-base text-zinc-500">
                      {t("myCustomersNone")}
                    </li>
                  )}
                  {myResults.map((c) => (
                    <li key={c.id}>{renderCustRow(c)}</li>
                  ))}
                </ul>
                {myHasMore && (
                  <button
                    type="button"
                    disabled={myLoading}
                    onClick={loadMoreMy}
                    className="mt-3 w-full rounded-md border border-white/15 py-3 text-base font-medium text-zinc-300 hover:border-amber-400/50 hover:bg-amber-400/5 disabled:opacity-40"
                  >
                    {myLoading ? t("searchTyping") : t("loadMore")}
                  </button>
                )}
              </section>
            )}

            {/* 2. 전체 고객 조회 — embedded(회원 상세) 일 때는 컨텍스트 고정이라 숨김 */}
            {!embedded && !cust && (
            <section className="rounded-2xl border border-amber-400/25 bg-zinc-900 p-4">
              <h2 className="text-base font-semibold uppercase tracking-[0.14em] text-amber-300/90">
                {t("stepCustomer")}
              </h2>
              {(
                <>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setTab("existing")}
                      className={tabBtn(tab === "existing")}
                    >
                      {t("tabExisting")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab("new")}
                      className={tabBtn(tab === "new")}
                    >
                      {t("tabNew")}
                    </button>
                  </div>

                  {tab === "existing" ? (
                    <div className="mt-3">
                      <div className="flex gap-2">
                        <input
                          value={q}
                          onChange={(e) => setQ(e.target.value)}
                          onKeyDown={(e) =>
                            e.key === "Enter" && doSearch()
                          }
                          placeholder={t("searchPlaceholder")}
                          className={field}
                        />
                        <button
                          type="button"
                          disabled={pending}
                          onClick={doSearch}
                          className="shrink-0 rounded-md border border-white/15 px-4 py-3 text-base font-medium text-zinc-300 hover:bg-white/5"
                        >
                          {t("searchBtn")}
                        </button>
                      </div>
                      {/* 라벨: 검색 비어있을 때 = "최근 등록 10명", 검색 중이면 숨김 */}
                      {q.trim().length === 0 && (
                        <div className="mt-3 text-base font-medium text-zinc-400">
                          {t("recentLabel")}
                        </div>
                      )}
                      <ul className="mt-2 space-y-2">
                        {pending && results.length === 0 && (
                          <li className="px-1 py-3 text-base text-zinc-500">
                            {t("searchTyping")}
                          </li>
                        )}
                        {!pending && results.length === 0 && searched && (
                          <li className="px-1 py-3 text-base text-zinc-500">
                            {t("noResults")}
                          </li>
                        )}
                        {results.map((c) => (
                          <li key={c.id}>{renderCustRow(c)}</li>
                        ))}
                      </ul>
                      {/* 빈 q 면 "최근 10명" 의도라 더 보기 숨김. 검색어 있을 때만 노출. */}
                      {hasMore && q.trim().length > 0 && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={loadMore}
                          className="mt-3 w-full rounded-md border border-white/15 py-3 text-base font-medium text-zinc-300 hover:border-amber-400/50 hover:bg-amber-400/5 disabled:opacity-40"
                        >
                          {pending ? t("searchTyping") : t("loadMore")}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <input
                        placeholder={t("fName")}
                        value={f.name}
                        onChange={(e) =>
                          setF({ ...f, name: e.target.value })
                        }
                        className={`${field} col-span-2`}
                      />
                      <input
                        placeholder={t("fPhone")}
                        value={f.phone}
                        inputMode="tel"
                        onChange={(e) =>
                          setF({ ...f, phone: e.target.value })
                        }
                        className={field}
                      />
                      <select
                        value={f.gender}
                        onChange={(e) =>
                          setF({ ...f, gender: e.target.value })
                        }
                        className={field}
                      >
                        <option value="MALE">{t("male")}</option>
                        <option value="FEMALE">{t("female")}</option>
                      </select>
                      <input
                        placeholder={t("fEmail")}
                        value={f.email}
                        inputMode="email"
                        onChange={(e) =>
                          setF({ ...f, email: e.target.value })
                        }
                        className={`${field} col-span-2`}
                      />
                      <label className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-zinc-400">
                          {t("fDob")}
                        </span>
                        <input
                          type="date"
                          lang={lang}
                          value={f.dob}
                          onChange={(e) =>
                            setF({ ...f, dob: e.target.value })
                          }
                          className={field}
                        />
                      </label>
                      <input
                        placeholder={t("fEmergency")}
                        value={f.emergencyContactPhone}
                        inputMode="tel"
                        onChange={(e) =>
                          setF({
                            ...f,
                            emergencyContactPhone: e.target.value,
                          })
                        }
                        className={field}
                      />
                      <input
                        placeholder={t("fNote")}
                        value={f.note}
                        onChange={(e) =>
                          setF({ ...f, note: e.target.value })
                        }
                        className={`${field} col-span-2`}
                      />
                      <button
                        type="button"
                        disabled={pending || !f.name || !f.phone}
                        onClick={doCreate}
                        className="col-span-2 rounded-md border border-emerald-400/40 bg-emerald-400/15 py-3 text-lg font-semibold text-emerald-300 transition hover:bg-emerald-400/25 disabled:opacity-40"
                      >
                        {t("createBtn")}
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>
            )}

            {/* 3. 카탈로그 발급 */}
            {cust && (
              <section className="mt-4 rounded-2xl border border-amber-400/25 bg-zinc-900 p-4">
                <h2 className="text-base font-semibold uppercase tracking-[0.14em] text-amber-300/90">
                  {t("stepCatalog")}
                </h2>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCat("membership")}
                    className={tabBtn(cat === "membership")}
                  >
                    {t("tabMembership")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCat("package")}
                    className={tabBtn(cat === "package")}
                  >
                    {t("tabPackage")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCat("combo")}
                    className={tabBtn(cat === "combo")}
                  >
                    {t("tabCombo")}
                  </button>
                </div>

                <ul className="mt-3 space-y-2">
                  {cat === "membership" &&
                    (memberships.length === 0 ? (
                      <li className="text-base text-zinc-500">
                        {t("noPlansHere")}
                      </li>
                    ) : (
                      memberships.map((m) => (
                        <li
                          key={m.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-white/15 p-4"
                        >
                          <span>
                            <span className="text-lg font-semibold text-white">
                              {m.name}
                            </span>
                            <span className="ml-2 text-sm text-zinc-400">
                              {m.durationDays}d
                            </span>
                          </span>
                          <span className="flex items-center gap-3">
                            <span className="text-lg font-semibold tabular-nums text-amber-300">
                              {peso(m.pricePhp)}
                            </span>
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() =>
                                addToCart({
                                  kind: "MEMBERSHIP",
                                  planId: m.id,
                                  name: m.name,
                                  pricePhp: m.pricePhp,
                                })
                              }
                              className="rounded-md border border-emerald-400/40 bg-emerald-400/15 px-4 py-2 text-base font-semibold text-emerald-300 transition hover:bg-emerald-400/25 disabled:opacity-40"
                            >
                              {t("addToCart")}
                            </button>
                          </span>
                        </li>
                      ))
                    ))}

                  {cat === "package" &&
                    (packages.length === 0 ? (
                      <li className="text-base text-zinc-500">
                        {t("noPlansHere")}
                      </li>
                    ) : (
                      packages.map((p) => (
                        <li
                          key={p.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-white/15 p-4"
                        >
                          <span>
                            <span className="text-lg font-semibold text-white">
                              {p.name}
                            </span>
                            <span className="ml-2 text-sm text-zinc-400">
                              {p.serviceName} · {p.sessionCount}회
                            </span>
                          </span>
                          <span className="flex items-center gap-3">
                            <span className="text-lg font-semibold tabular-nums text-amber-300">
                              {peso(p.pricePhp)}
                            </span>
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() =>
                                addToCart({
                                  kind: "PACKAGE",
                                  planId: p.id,
                                  name: p.name,
                                  pricePhp: p.pricePhp,
                                })
                              }
                              className="rounded-md border border-emerald-400/40 bg-emerald-400/15 px-4 py-2 text-base font-semibold text-emerald-300 transition hover:bg-emerald-400/25 disabled:opacity-40"
                            >
                              {t("addToCart")}
                            </button>
                          </span>
                        </li>
                      ))
                    ))}

                  {cat === "combo" &&
                    (combos.length === 0 ? (
                      <li className="text-base text-zinc-500">
                        {t("noPlansHere")}
                      </li>
                    ) : (
                      combos.map((c) => (
                        <li
                          key={c.id}
                          className="rounded-lg border border-white/15 p-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-lg font-semibold text-white">
                              {c.name}
                            </span>
                            <span className="flex items-center gap-3">
                              <span className="text-lg font-semibold tabular-nums text-amber-300">
                                {peso(c.pricePhp)}
                              </span>
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() =>
                                  addToCart({
                                    kind: "COMBO",
                                    planId: c.id,
                                    name: c.name,
                                    pricePhp: c.pricePhp,
                                  })
                                }
                                className="rounded-md border border-emerald-400/40 bg-emerald-400/15 px-4 py-2 text-base font-semibold text-emerald-300 transition hover:bg-emerald-400/25 disabled:opacity-40"
                              >
                                {t("addToCart")}
                              </button>
                            </span>
                          </div>
                          <p className="mt-1.5 text-sm text-zinc-400">
                            {t("comboIncludes")}: {c.parts.join(" + ")}
                          </p>
                        </li>
                      ))
                    ))}
                </ul>
              </section>
            )}
            </div>

            {cust && (
              <aside className="mt-4 lg:sticky lg:top-4 lg:mt-0">
                <section className="rounded-2xl border border-emerald-400/30 bg-zinc-900 p-3 lg:min-h-[80px]">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold uppercase tracking-[0.14em] text-emerald-300/90">
                      {t("cartTitle")}
                      {cart.length > 0 ? ` · ${cart.length}` : ""}
                    </h2>
                    {cart.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setCart([])}
                        className="text-sm text-zinc-400 hover:text-rose-300"
                      >
                        {t("cartClear")}
                      </button>
                    )}
                  </div>
                  {cart.length === 0 ? (
                    <p className="mt-1.5 text-sm text-zinc-500">
                      {t("cartEmpty")}
                    </p>
                  ) : (
                    <>
                      <ul className="mt-3 space-y-2">
                        {cart.map((l) => (
                          <li
                            key={l.uid}
                            className="flex items-center justify-between gap-2 rounded-lg border border-white/10 p-3"
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-base font-semibold text-white">
                                {l.name}
                              </span>
                              <span className="text-xs text-zinc-400">
                                {t(
                                  l.kind === "MEMBERSHIP"
                                    ? "tabMembership"
                                    : l.kind === "PACKAGE"
                                      ? "tabPackage"
                                      : "tabCombo",
                                )}
                              </span>
                            </span>
                            <span className="flex shrink-0 items-center gap-2">
                              {(() => {
                                const d = lineDiscount(l);
                                return d > 0 ? (
                                  <span className="text-right">
                                    <span className="block text-xs tabular-nums text-zinc-500 line-through">
                                      {peso(l.pricePhp)}
                                    </span>
                                    <span className="block text-base font-semibold tabular-nums text-emerald-300">
                                      {peso(l.pricePhp - d)}
                                    </span>
                                  </span>
                                ) : (
                                  <span className="tabular-nums text-base font-semibold text-amber-300">
                                    {peso(l.pricePhp)}
                                  </span>
                                );
                              })()}
                              <button
                                type="button"
                                aria-label={t("cartClear")}
                                onClick={() => removeFromCart(l.uid)}
                                className="rounded-md border border-white/15 px-2.5 py-1.5 text-sm text-zinc-400 hover:border-rose-400/50 hover:text-rose-300"
                              >
                                ✕
                              </button>
                            </span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-3 border-t border-white/10 pt-3">
                        {cartSaved > 0 && (
                          <div className="mb-1.5 flex items-center justify-between text-sm text-emerald-300">
                            <span>{t("cartSavedLabel")}</span>
                            <span className="tabular-nums">
                              − {peso(cartSaved)}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-base text-zinc-400">
                            {t("cartTotal")}
                          </span>
                          <span className="tabular-nums text-xl font-bold text-amber-300">
                            {peso(cartTotal)}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={doIssueCart}
                        className="mt-3 hidden w-full rounded-lg border border-emerald-400/50 bg-emerald-400/20 py-3.5 text-lg font-semibold text-emerald-200 transition hover:bg-emerald-400/30 disabled:opacity-40 lg:block"
                      >
                        {t("cartIssueBtn", { count: cart.length })}
                      </button>
                    </>
                  )}
                </section>
              </aside>
            )}

            {cart.length > 0 && (
              <div className="fixed inset-x-0 bottom-0 z-40 border-t border-emerald-400/30 bg-zinc-950/95 p-3 backdrop-blur lg:hidden">
                <button
                  type="button"
                  disabled={pending}
                  onClick={doIssueCart}
                  className="flex w-full items-center justify-between rounded-lg border border-emerald-400/50 bg-emerald-400/20 px-4 py-3.5 text-lg font-semibold text-emerald-200 disabled:opacity-40"
                >
                  <span>{t("cartIssueBtn", { count: cart.length })}</span>
                  <span className="tabular-nums">{peso(cartTotal)}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
