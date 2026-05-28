import Link from "next/link";

export function PreviewHeader({
  role,
  variant,
  back,
}: {
  role: string;
  variant: string;
  back: string;
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-[#DDDDDD] bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link
          href={back}
          className="text-sm font-medium text-[#222222] hover:underline"
        >
          &larr; v2 index
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-[#717171]">
            {role}
          </span>
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[#FF385C] px-2 text-xs font-semibold text-white">
            {variant}
          </span>
        </div>
      </div>
    </header>
  );
}

export function DarkHeader({
  role,
  variant,
  back,
}: {
  role: string;
  variant: string;
  back: string;
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-[#333333] bg-[#222222]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link
          href={back}
          className="text-sm font-medium text-white hover:underline"
        >
          &larr; v2 index
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-[#A0A0A0]">
            {role}
          </span>
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[#FF385C] px-2 text-xs font-semibold text-white">
            {variant}
          </span>
        </div>
      </div>
    </header>
  );
}
