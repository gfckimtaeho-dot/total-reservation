import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, Noto_Sans_KR, Noto_Serif_KR } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing, type AppLocale } from "@/lib/i18n/config";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import "../globals.css";

// Mindbody-style typography pair: transitional serif headlines + grotesque body.
// Korean glyphs fall back to Noto Serif KR / Noto Sans KR in the same stack.
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-fraunces",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const notoSerifKR = Noto_Serif_KR({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-serif-kr",
  display: "swap",
});

const notoSansKR = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-sans-kr",
  display: "swap",
});

export const metadata: Metadata = {
  title: "예약가즈아",
  description: "헬스장 운영 관리 SaaS",
  appleWebApp: {
    capable: true,
    title: "예약가즈아",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function LangLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}>) {
  const { lang } = await params;
  if (!routing.locales.includes(lang as AppLocale)) notFound();

  const messages = await getMessages();

  return (
    <html
      lang={lang}
      className={`${fraunces.variable} ${inter.variable} ${notoSerifKR.variable} ${notoSansKR.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
