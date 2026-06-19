import { getTranslations } from "next-intl/server";

export type AttendanceCell = {
  hour: number;
  min: number;
  lateMin: number | null;
};

export type AttendanceRow = {
  userId: string;
  name: string;
  cells: (AttendanceCell | null)[];
};

function fmtTime(hour: number, min: number): string {
  return `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export async function AttendanceMatrix({
  attendance,
  lang,
}: {
  attendance: AttendanceRow[];
  lang: string;
}) {
  const t = await getTranslations("trainers");
  const weekdays =
    lang === "en"
      ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
      : ["월", "화", "수", "목", "금", "토", "일"];

  if (attendance.length === 0) {
    return (
      <section className="mt-6">
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">
          {t("attendanceEmpty")}
        </div>
      </section>
    );
  }

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between px-1 pb-2 pt-1">
        <h2 className="text-base font-semibold tracking-tight text-zinc-900">
          {t("attendanceTitle")}
        </h2>
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
          {t("attendanceWeekRange")}
        </span>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50">
              <th className="sticky left-0 z-10 bg-zinc-50 px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                {t("attendanceColName")}
              </th>
              {weekdays.map((w) => (
                <th
                  key={w}
                  className="px-3 py-3 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500"
                >
                  {w}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {attendance.map((row) => (
              <tr
                key={row.userId}
                className="border-b border-zinc-100 last:border-b-0"
              >
                <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-4 py-3 text-left text-sm font-medium text-zinc-900">
                  {row.name}
                </td>
                {row.cells.map((c, i) => (
                  <td
                    key={i}
                    className="px-3 py-3 text-center text-xs tabular-nums"
                  >
                    {c ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="font-mono text-zinc-700">
                          {fmtTime(c.hour, c.min)}
                        </span>
                        {c.lateMin != null && c.lateMin > 0 && (
                          <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[9px] font-bold text-rose-700">
                            {t("attendanceLate", { min: c.lateMin })}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[11px] text-zinc-300"></span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
