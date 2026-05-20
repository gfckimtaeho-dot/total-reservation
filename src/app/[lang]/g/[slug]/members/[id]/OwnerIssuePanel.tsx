"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { issueCart } from "../../dashboard/service-actions";
import { pickBestPromo, type PromoLike } from "@/lib/catalog/promo";

// 사장 회원 상세 전용 발급 패널. 트레이너 IntakeFlow와 디자인을 공유하지 않음.
//   - 회원 컨텍스트는 props로 고정(검색·신규 등록 단계 없음)
//   - 카탈로그 3탭 + 장바구니 + 발급 버튼 + 완료 메시지
//   - 톤(normal/black/white) — 회원 상세 페이지 SECTION/TITLE/SUBTLE 와 일관
//   - 발급 로직은 issueCart 서버 액션 그대로 호출(트레이너 화면과 행동 동일)

type Tone = "normal" | "black" | "white";

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

const TONE = {
  normal: {
    subCard: "rounded-xl bg-amber-50/60 ring-1 ring-amber-200/60 p-4",
    title: "text-ink",
    subtle: "text-zinc-600",
    eyebrow: "text-ink/70",
    rowCard: "rounded-lg bg-white ring-1 ring-amber-200/60 p-3",
    tabActive: "bg-amber-400 text-zinc-950",
    tabInactive:
      "bg-white text-zinc-700 ring-1 ring-amber-200/60 hover:bg-amber-50",
    addBtn:
      "rounded-md bg-amber-400 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-40",
    price: "text-ink",
    priceSale: "text-emerald-600",
    priceStrike: "text-zinc-400 line-through",
    cartCard: "rounded-xl bg-white ring-2 ring-amber-300/70 p-4",
    cartLine: "rounded-lg bg-amber-50/40 ring-1 ring-amber-200/40 p-2.5",
    issueBtn:
      "w-full rounded-lg bg-amber-500 py-3 text-sm font-semibold text-white hover:bg-amber-400 disabled:opacity-40",
    issueBarMobile:
      "rounded-lg bg-amber-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40",
    mobileBar: "bg-white/95 border-t border-amber-200/60",
    removeBtn:
      "rounded-md ring-1 ring-amber-200/60 px-2 py-1 text-xs text-zinc-600 hover:text-rose-600 hover:ring-rose-300",
    clearLink: "text-xs text-zinc-500 hover:text-rose-500",
    doneCard: "rounded-xl bg-emerald-50 ring-1 ring-emerald-200 p-5 text-center",
    doneText: "text-emerald-700",
    againBtn:
      "rounded-md bg-amber-100 px-4 py-2 text-sm font-medium text-ink hover:bg-amber-200",
  },
  black: {
    subCard: "rounded-xl bg-zinc-950 ring-1 ring-white/10 p-4",
    title: "text-white",
    subtle: "text-zinc-400",
    eyebrow: "text-lime-300/80",
    rowCard: "rounded-lg bg-zinc-900 ring-1 ring-white/10 p-3",
    tabActive: "bg-lime-300 text-zinc-950",
    tabInactive:
      "bg-zinc-900 text-zinc-400 ring-1 ring-white/10 hover:bg-zinc-800",
    addBtn:
      "rounded-md bg-lime-300 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-lime-200 disabled:opacity-40",
    price: "text-zinc-100",
    priceSale: "text-emerald-300",
    priceStrike: "text-zinc-500 line-through",
    cartCard: "rounded-xl bg-zinc-950 ring-2 ring-lime-300/40 p-4",
    cartLine: "rounded-lg bg-zinc-900 ring-1 ring-white/10 p-2.5",
    issueBtn:
      "w-full rounded-lg bg-lime-300 py-3 text-sm font-semibold text-zinc-950 hover:bg-lime-200 disabled:opacity-40",
    issueBarMobile:
      "rounded-lg bg-lime-300 px-4 py-3 text-sm font-semibold text-zinc-950 disabled:opacity-40",
    mobileBar: "bg-zinc-950/95 border-t border-white/10",
    removeBtn:
      "rounded-md ring-1 ring-white/15 px-2 py-1 text-xs text-zinc-400 hover:text-rose-300 hover:ring-rose-400/40",
    clearLink: "text-xs text-zinc-500 hover:text-rose-300",
    doneCard:
      "rounded-xl bg-emerald-500/10 ring-1 ring-emerald-400/30 p-5 text-center",
    doneText: "text-emerald-300",
    againBtn:
      "rounded-md bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700",
  },
  white: {
    subCard: "rounded-xl bg-violet-50/60 ring-1 ring-violet-100 p-4",
    title: "text-ink",
    subtle: "text-zinc-600",
    eyebrow: "text-violet-700/80",
    rowCard: "rounded-lg bg-white ring-1 ring-violet-100 p-3",
    tabActive: "bg-violet-500 text-white",
    tabInactive:
      "bg-white text-zinc-700 ring-1 ring-violet-100 hover:bg-violet-50",
    addBtn:
      "rounded-md bg-violet-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-400 disabled:opacity-40",
    price: "text-ink",
    priceSale: "text-emerald-600",
    priceStrike: "text-zinc-400 line-through",
    cartCard: "rounded-xl bg-white ring-2 ring-violet-300 p-4",
    cartLine: "rounded-lg bg-violet-50/60 ring-1 ring-violet-100 p-2.5",
    issueBtn:
      "w-full rounded-lg bg-violet-500 py-3 text-sm font-semibold text-white hover:bg-violet-400 disabled:opacity-40",
    issueBarMobile:
      "rounded-lg bg-violet-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40",
    mobileBar: "bg-white/95 border-t border-violet-100",
    removeBtn:
      "rounded-md ring-1 ring-violet-100 px-2 py-1 text-xs text-zinc-600 hover:text-rose-600 hover:ring-rose-300",
    clearLink: "text-xs text-zinc-500 hover:text-rose-500",
    doneCard: "rounded-xl bg-emerald-50 ring-1 ring-emerald-200 p-5 text-center",
    doneText: "text-emerald-700",
    againBtn:
      "rounded-md bg-violet-100 px-4 py-2 text-sm font-medium text-ink hover:bg-violet-200",
  },
} as const;

type CartLine = {
  uid: string;
  kind: "MEMBERSHIP" | "PACKAGE" | "COMBO";
  planId: string;
  name: string;
  pricePhp: number;
};

export function OwnerIssuePanel({
  tone,
  slug,
  customer,
  memberships,
  packages,
  combos,
  promotions,
}: {
  tone: Tone;
  slug: string;
  lang: string;
  customer: { id: string; name: string };
  memberships: Membership[];
  packages: Pkg[];
  combos: Combo[];
  promotions: PromoLike[];
}) {
  const t = useTranslations("trainerCal");
  const tk = TONE[tone];
  const router = useRouter();
  const [pending, start] = useTransition();
  const [cat, setCat] = useState<"membership" | "package" | "combo">(
    "membership",
  );
  const [cart, setCart] = useState<CartLine[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [issuedN, setIssuedN] = useState(0);
  const uidRef = useRef(0);

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

  function doIssue() {
    if (cart.length === 0) return;
    setErr(null);
    start(async () => {
      const r = await issueCart({
        slug,
        customerUserId: customer.id,
        items: cart.map(({ kind, planId }) => ({ kind, planId })),
      });
      if (r.ok) {
        setIssuedN(cart.length);
        setCart([]);
        setDone(true);
        router.refresh();
      } else {
        setErr(r.error || t("actionFailed"));
      }
    });
  }

  const peso = (n: number) => `₱${n.toLocaleString()}`;

  if (done) {
    return (
      <div className={tk.doneCard}>
        <p className={`text-lg font-semibold ${tk.doneText}`}>
          ✓ {t("issuedCount", { count: issuedN })}
        </p>
        <p className={`mt-1 text-sm ${tk.subtle}`}>{customer.name}</p>
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => setDone(false)}
            className={tk.againBtn}
          >
            {t("issueAnother")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-4">
      {/* 카탈로그 — 헤딩은 외부 섹션 "서비스 발급" 이 이미 표시 */}
      <div className={tk.subCard}>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setCat("membership")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${cat === "membership" ? tk.tabActive : tk.tabInactive}`}
          >
            {t("tabMembership")}
          </button>
          <button
            type="button"
            onClick={() => setCat("package")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${cat === "package" ? tk.tabActive : tk.tabInactive}`}
          >
            {t("tabPackage")}
          </button>
          <button
            type="button"
            onClick={() => setCat("combo")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${cat === "combo" ? tk.tabActive : tk.tabInactive}`}
          >
            {t("tabCombo")}
          </button>
        </div>

        <ul className="mt-3 space-y-2">
          {cat === "membership" &&
            (memberships.length === 0 ? (
              <li className={`text-sm ${tk.subtle}`}>{t("noPlansHere")}</li>
            ) : (
              memberships.map((m) => (
                <li
                  key={m.id}
                  className={`flex items-center justify-between gap-3 ${tk.rowCard}`}
                >
                  <span>
                    <span className={`font-medium ${tk.title}`}>
                      {m.name}
                    </span>
                    <span className={`ml-2 text-xs ${tk.subtle}`}>
                      {m.durationDays}d
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className={`tabular-nums ${tk.price}`}>
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
                      className={tk.addBtn}
                    >
                      {t("addToCart")}
                    </button>
                  </span>
                </li>
              ))
            ))}

          {cat === "package" &&
            (packages.length === 0 ? (
              <li className={`text-sm ${tk.subtle}`}>{t("noPlansHere")}</li>
            ) : (
              packages.map((p) => (
                <li
                  key={p.id}
                  className={`flex items-center justify-between gap-3 ${tk.rowCard}`}
                >
                  <span>
                    <span className={`font-medium ${tk.title}`}>
                      {p.name}
                    </span>
                    <span className={`ml-2 text-xs ${tk.subtle}`}>
                      {p.serviceName} · {p.sessionCount}회
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className={`tabular-nums ${tk.price}`}>
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
                      className={tk.addBtn}
                    >
                      {t("addToCart")}
                    </button>
                  </span>
                </li>
              ))
            ))}

          {cat === "combo" &&
            (combos.length === 0 ? (
              <li className={`text-sm ${tk.subtle}`}>{t("noPlansHere")}</li>
            ) : (
              combos.map((c) => (
                <li key={c.id} className={tk.rowCard}>
                  <div className="flex items-center justify-between gap-3">
                    <span className={`font-medium ${tk.title}`}>{c.name}</span>
                    <span className="flex items-center gap-3">
                      <span className={`tabular-nums ${tk.price}`}>
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
                        className={tk.addBtn}
                      >
                        {t("addToCart")}
                      </button>
                    </span>
                  </div>
                  <p className={`mt-1 text-xs ${tk.subtle}`}>
                    {t("comboIncludes")}: {c.parts.join(" + ")}
                  </p>
                </li>
              ))
            ))}
        </ul>
      </div>

      {/* 장바구니 */}
      <aside className="mt-4 lg:sticky lg:top-4 lg:mt-0">
        <div className={tk.cartCard}>
          <div className="flex items-center justify-between">
            <h3
              className={`text-xs font-semibold uppercase tracking-[0.18em] ${tk.eyebrow}`}
            >
              {t("cartTitle")}
              {cart.length > 0 ? ` · ${cart.length}` : ""}
            </h3>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={() => setCart([])}
                className={tk.clearLink}
              >
                {t("cartClear")}
              </button>
            )}
          </div>
          {cart.length === 0 ? (
            <p className={`mt-3 text-sm ${tk.subtle}`}>{t("cartEmpty")}</p>
          ) : (
            <>
              <ul className="mt-3 space-y-2">
                {cart.map((l) => {
                  const d = lineDiscount(l);
                  return (
                    <li
                      key={l.uid}
                      className={`flex items-center justify-between gap-2 ${tk.cartLine}`}
                    >
                      <span className="min-w-0">
                        <span className={`block truncate text-sm font-medium ${tk.title}`}>
                          {l.name}
                        </span>
                        <span className={`text-[11px] ${tk.subtle}`}>
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
                        {d > 0 ? (
                          <span className="text-right">
                            <span className={`block text-[11px] tabular-nums ${tk.priceStrike}`}>
                              {peso(l.pricePhp)}
                            </span>
                            <span className={`block text-sm font-semibold tabular-nums ${tk.priceSale}`}>
                              {peso(l.pricePhp - d)}
                            </span>
                          </span>
                        ) : (
                          <span className={`tabular-nums text-sm ${tk.price}`}>
                            {peso(l.pricePhp)}
                          </span>
                        )}
                        <button
                          type="button"
                          aria-label={t("cartClear")}
                          onClick={() => removeFromCart(l.uid)}
                          className={tk.removeBtn}
                        >
                          ✕
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
              <div className={`mt-3 border-t pt-3 ${tone === "black" ? "border-white/10" : tone === "white" ? "border-violet-100" : "border-amber-200/60"}`}>
                {cartSaved > 0 && (
                  <div className={`mb-1 flex items-center justify-between text-xs ${tk.priceSale}`}>
                    <span>{t("cartSavedLabel")}</span>
                    <span className="tabular-nums">− {peso(cartSaved)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${tk.subtle}`}>{t("cartTotal")}</span>
                  <span className={`tabular-nums text-base font-semibold ${tk.title}`}>
                    {peso(cartTotal)}
                  </span>
                </div>
              </div>
              {err && <p className="mt-2 text-sm text-rose-500">{err}</p>}
              <button
                type="button"
                disabled={pending}
                onClick={doIssue}
                className={`mt-3 hidden lg:block ${tk.issueBtn}`}
              >
                {t("cartIssueBtn", { count: cart.length })}
              </button>
            </>
          )}
        </div>

        {/* 모바일 하단 발급 바 — 패널이 회원 상세 안에 있으므로 fixed 대신 in-flow */}
        {cart.length > 0 && (
          <div className={`mt-3 p-3 lg:hidden ${tk.mobileBar} rounded-lg`}>
            <button
              type="button"
              disabled={pending}
              onClick={doIssue}
              className={`flex w-full items-center justify-between ${tk.issueBarMobile}`}
            >
              <span>{t("cartIssueBtn", { count: cart.length })}</span>
              <span className="tabular-nums">{peso(cartTotal)}</span>
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
