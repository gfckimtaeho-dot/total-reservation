"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { createMember } from "../members/actions";
import {
  searchCustomers,
  issueService,
} from "../dashboard/service-actions";

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
type Cust = { id: string; name: string; phone?: string | null };

export function IntakeFlow({
  slug,
  lang,
  preset,
  memberships,
  packages,
  combos,
}: {
  slug: string;
  lang: string;
  preset: { id: string; name: string } | null;
  memberships: Membership[];
  packages: Pkg[];
  combos: Combo[];
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
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

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
    start(async () => {
      const r = await searchCustomers({ slug, q });
      if (r.ok) setResults((r.data as Cust[]) ?? []);
    });
  }

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

  function doIssue(kind: "MEMBERSHIP" | "PACKAGE" | "COMBO", planId: string) {
    if (!cust) return;
    setErr(null);
    start(async () => {
      const r = await issueService({
        slug,
        customerUserId: cust.id,
        kind,
        planId,
      });
      if (r.ok) setDone(true);
      else setErr(r.error || t("actionFailed"));
    });
  }

  const field =
    "w-full rounded-md border border-white/15 bg-zinc-950 px-3 py-2 text-sm";
  const tabBtn = (on: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition ${
      on
        ? "bg-amber-400 text-zinc-950"
        : "border border-white/15 text-zinc-300 hover:bg-white/5"
    }`;

  return (
    <div className="min-h-[100dvh] bg-black p-4 text-zinc-100">
      <div className="mx-auto max-w-xl">
        <div className="flex items-center justify-between">
          <h1 className="font-heading text-lg text-white">
            {t("intakeTitle")}
          </h1>
          <Link
            href={`/${lang}/g/${slug}/dashboard`}
            className="rounded-md border border-white/15 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5"
          >
            ← {t("goDashboard")}
          </Link>
        </div>

        {err && <p className="mt-3 text-sm text-rose-400">{err}</p>}

        {done ? (
          <div className="mt-6 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-6 text-center">
            <p className="text-lg font-semibold text-emerald-300">
              ✓ {t("issuedOk")}
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
              <Link
                href={`/${lang}/g/${slug}/dashboard`}
                className="rounded-md border border-white/15 px-4 py-2 text-sm text-zinc-300"
              >
                {t("goDashboard")}
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* 1. 고객 */}
            <section className="mt-4 rounded-2xl border border-amber-400/25 bg-zinc-900 p-4">
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300/90">
                {t("stepCustomer")}
              </h2>
              {cust ? (
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm">
                    <span className="text-zinc-500">
                      {t("pickedCustomer")}:{" "}
                    </span>
                    <span className="font-semibold text-white">
                      {cust.name}
                    </span>
                  </span>
                  {!preset && (
                    <button
                      type="button"
                      onClick={() => setCust(null)}
                      className="rounded-md border border-white/15 px-2.5 py-1 text-xs text-zinc-400"
                    >
                      {t("changeCustomer")}
                    </button>
                  )}
                </div>
              ) : (
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
                          className="shrink-0 rounded-md border border-white/15 px-3 text-xs text-zinc-300"
                        >
                          {t("searchBtn")}
                        </button>
                      </div>
                      <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
                        {results.map((c) => (
                          <li key={c.id}>
                            <button
                              type="button"
                              onClick={() =>
                                setCust({ id: c.id, name: c.name })
                              }
                              className="flex w-full items-center justify-between rounded-md border border-white/15 px-3 py-2 text-sm hover:border-amber-400/50 hover:bg-amber-400/10"
                            >
                              <span className="font-medium">{c.name}</span>
                              <span className="text-xs text-zinc-500">
                                {c.phone ?? ""}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
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
                      <input
                        type="date"
                        lang={lang}
                        value={f.dob}
                        onChange={(e) =>
                          setF({ ...f, dob: e.target.value })
                        }
                        className={field}
                      />
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
                        className="col-span-2 rounded-md border border-emerald-400/40 bg-emerald-400/15 py-2.5 text-sm font-semibold text-emerald-300 disabled:opacity-40"
                      >
                        {t("createBtn")}
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>

            {/* 2. 카탈로그 발급 */}
            {cust && (
              <section className="mt-4 rounded-2xl border border-amber-400/25 bg-zinc-900 p-4">
                <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300/90">
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
                      <li className="text-sm text-zinc-500">
                        {t("noPlansHere")}
                      </li>
                    ) : (
                      memberships.map((m) => (
                        <li
                          key={m.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-white/15 p-3"
                        >
                          <span>
                            <span className="font-medium text-white">
                              {m.name}
                            </span>
                            <span className="ml-2 text-xs text-zinc-500">
                              {m.durationDays}d
                            </span>
                          </span>
                          <span className="flex items-center gap-3">
                            <span className="tabular-nums text-amber-300">
                              {peso(m.pricePhp)}
                            </span>
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => doIssue("MEMBERSHIP", m.id)}
                              className="rounded-md border border-emerald-400/40 bg-emerald-400/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 disabled:opacity-40"
                            >
                              {t("issueBtn")}
                            </button>
                          </span>
                        </li>
                      ))
                    ))}

                  {cat === "package" &&
                    (packages.length === 0 ? (
                      <li className="text-sm text-zinc-500">
                        {t("noPlansHere")}
                      </li>
                    ) : (
                      packages.map((p) => (
                        <li
                          key={p.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-white/15 p-3"
                        >
                          <span>
                            <span className="font-medium text-white">
                              {p.name}
                            </span>
                            <span className="ml-2 text-xs text-zinc-500">
                              {p.serviceName} · {p.sessionCount}회
                            </span>
                          </span>
                          <span className="flex items-center gap-3">
                            <span className="tabular-nums text-amber-300">
                              {peso(p.pricePhp)}
                            </span>
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => doIssue("PACKAGE", p.id)}
                              className="rounded-md border border-emerald-400/40 bg-emerald-400/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 disabled:opacity-40"
                            >
                              {t("issueBtn")}
                            </button>
                          </span>
                        </li>
                      ))
                    ))}

                  {cat === "combo" &&
                    (combos.length === 0 ? (
                      <li className="text-sm text-zinc-500">
                        {t("noPlansHere")}
                      </li>
                    ) : (
                      combos.map((c) => (
                        <li
                          key={c.id}
                          className="rounded-lg border border-white/15 p-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-medium text-white">
                              {c.name}
                            </span>
                            <span className="flex items-center gap-3">
                              <span className="tabular-nums text-amber-300">
                                {peso(c.pricePhp)}
                              </span>
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() => doIssue("COMBO", c.id)}
                                className="rounded-md border border-emerald-400/40 bg-emerald-400/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 disabled:opacity-40"
                              >
                                {t("issueBtn")}
                              </button>
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-zinc-500">
                            {t("comboIncludes")}: {c.parts.join(" + ")}
                          </p>
                        </li>
                      ))
                    ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
