type Tone = "normal" | "black" | "white";

const TONE = {
  normal: {
    wrap: "bg-white ring-1 ring-amber-200/60",
    label: "text-ink/70",
    field: "border-amber-200/60 bg-white text-ink focus:border-ink focus:ring-ink/20",
    radioActive: "bg-band/40 text-ink ring-1 ring-ink",
    radioInactive: "bg-white text-zinc-600 ring-1 ring-amber-200/60 hover:ring-ink/40",
    submit: "bg-ink text-white hover:bg-ink/90",
    reset: "border-amber-200/60 bg-white text-zinc-600 hover:border-ink",
    checkActive: "border-ink bg-band/40 text-ink",
    checkInactive: "border-amber-200/60 bg-white text-zinc-600 hover:border-ink/40",
  },
  black: {
    wrap: "bg-zinc-900 ring-1 ring-white/10",
    label: "text-zinc-300",
    field: "border-white/10 bg-zinc-800 text-zinc-100 placeholder-zinc-500 focus:border-lime-300 focus:ring-lime-300/20",
    radioActive: "bg-lime-300/20 text-lime-300 ring-1 ring-lime-300",
    radioInactive: "bg-zinc-800 text-zinc-400 ring-1 ring-white/10 hover:ring-lime-300/40",
    submit: "bg-lime-300 text-zinc-950 hover:bg-lime-200",
    reset: "border-white/10 bg-zinc-800 text-zinc-300 hover:border-lime-300",
    checkActive: "border-lime-300 bg-lime-300/10 text-lime-300",
    checkInactive: "border-white/10 bg-zinc-800 text-zinc-400 hover:border-lime-300/40",
  },
  white: {
    wrap: "bg-white ring-1 ring-zinc-200",
    label: "text-ink/70",
    field: "border-zinc-300 bg-white text-ink focus:border-ink focus:ring-ink/20",
    radioActive: "bg-sky-100 text-sky-900 ring-1 ring-sky-700",
    radioInactive: "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:ring-ink/40",
    submit: "bg-ink text-white hover:bg-ink/90",
    reset: "border-zinc-300 bg-white text-zinc-600 hover:border-ink",
    checkActive: "border-sky-700 bg-sky-100 text-sky-900",
    checkInactive: "border-zinc-300 bg-white text-zinc-600 hover:border-ink/40",
  },
} as const;

const GENDERS = [
  { key: "all", label: "전체" },
  { key: "MALE", label: "남" },
  { key: "FEMALE", label: "여" },
] as const;

export function MembersSearch({
  tone,
  q,
  gender,
  expiringSoon,
}: {
  tone: Tone;
  q: string;
  gender: "all" | "MALE" | "FEMALE";
  expiringSoon: boolean;
}) {
  const t = TONE[tone];
  return (
    <form
      method="get"
      className={`mb-4 flex flex-wrap items-end gap-4 rounded-2xl px-5 py-4 ${t.wrap}`}
    >
      <label className="flex flex-col gap-1.5">
        <span className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${t.label}`}>
          이름 검색
        </span>
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="회원 이름"
          className={`h-9 rounded-md border px-3 text-sm transition focus:outline-none focus:ring-2 ${t.field}`}
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${t.label}`}>
          성별
        </span>
        <div className="flex gap-1">
          {GENDERS.map((g) => (
            <label
              key={g.key}
              className={`cursor-pointer rounded-md px-3 py-1.5 text-sm transition has-[:checked]:${t.radioActive} ${t.radioInactive}`}
            >
              <input
                type="radio"
                name="gender"
                value={g.key}
                defaultChecked={g.key === gender}
                className="sr-only"
              />
              {g.label}
            </label>
          ))}
        </div>
      </div>

      <label
        className={`flex h-9 cursor-pointer items-center gap-2 self-end rounded-md border px-3 text-sm transition has-[:checked]:${t.checkActive} ${t.checkInactive}`}
      >
        <input
          type="checkbox"
          name="expiringSoon"
          value="1"
          defaultChecked={expiringSoon}
          className="h-4 w-4 accent-ink"
        />
        만료 1주일 내
      </label>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          className={`h-9 rounded-md px-4 text-sm font-medium transition ${t.submit}`}
        >
          검색
        </button>
        <a
          href="?"
          className={`inline-flex h-9 items-center rounded-md border px-3 text-sm transition ${t.reset}`}
        >
          초기화
        </a>
      </div>
    </form>
  );
}
