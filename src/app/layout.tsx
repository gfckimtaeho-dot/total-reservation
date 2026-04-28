import { Geist } from "next/font/google";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});


// Root layout is intentionally a pass-through.
// The actual <html>/<body>/font/i18n provider live in src/app/[lang]/layout.tsx
// because <html lang> must be set dynamically per locale.
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
