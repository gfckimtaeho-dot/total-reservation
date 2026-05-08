import { getTheme } from "@/lib/theme";
import { SidebarNav } from "./dashboard/SidebarNav";

const PAGE_BG = {
  normal: "bg-amber-50/50",
  black: "bg-zinc-950 text-zinc-200",
  white: "bg-white",
} as const;

const SIDEBAR_BG = {
  normal: "bg-band",
  black: "bg-black",
  white: "border-r border-zinc-100 bg-white",
} as const;

const SIDEBAR_BORDER = {
  normal: "border-ink/10",
  black: "border-white/5",
  white: "border-zinc-100",
} as const;

const HEADER_BORDER = {
  normal: "border-amber-200/60",
  black: "border-white/5",
  white: "border-zinc-100",
} as const;

const SKELETON = {
  normal: "bg-amber-100/70",
  black: "bg-zinc-800/70",
  white: "bg-zinc-100",
} as const;

export default async function GymLoading() {
  const theme = await getTheme();
  return (
    <div className={`flex min-h-screen ${PAGE_BG[theme]}`}>
      <aside
        className={`hidden w-60 shrink-0 flex-col lg:flex ${SIDEBAR_BG[theme]}`}
      >
        <div className={`border-b px-6 py-6 ${SIDEBAR_BORDER[theme]}`}>
          <div className={`h-3 w-16 animate-pulse rounded ${SKELETON[theme]}`} />
          <div className={`mt-2 h-5 w-32 animate-pulse rounded ${SKELETON[theme]}`} />
          <div className={`mt-1 h-3 w-20 animate-pulse rounded ${SKELETON[theme]}`} />
        </div>
        <SidebarNav tone={theme} />
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <header
          className={`flex items-center justify-between border-b px-8 py-5 ${HEADER_BORDER[theme]}`}
        >
          <div>
            <div className={`h-3 w-20 animate-pulse rounded ${SKELETON[theme]}`} />
            <div className={`mt-2 h-6 w-40 animate-pulse rounded ${SKELETON[theme]}`} />
          </div>
        </header>

        <div className="mx-auto w-full max-w-5xl space-y-5 p-6">
          <div className={`h-32 animate-pulse rounded-2xl ${SKELETON[theme]}`} />
          <div className={`h-48 animate-pulse rounded-2xl ${SKELETON[theme]}`} />
          <div className={`h-64 animate-pulse rounded-2xl ${SKELETON[theme]}`} />
        </div>
      </main>
    </div>
  );
}
