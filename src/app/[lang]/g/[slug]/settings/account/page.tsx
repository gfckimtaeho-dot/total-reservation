import { getTranslations } from "next-intl/server";
import { requireGymStaff } from "@/lib/auth/dal";
import { OwnerShell } from "../../OwnerShell";
import { AccountForm } from "./AccountForm";

export default async function MyAccountPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  const user = await requireGymStaff(slug);
  const business = user.business!;
  const t = await getTranslations("settings.account");

  return (
    <OwnerShell
      lang={lang}
      slug={slug}
      businessName={business.name}
      subtitle={t("title")}
    >
      <main className="bg-white">
        <div className="mx-auto w-full max-w-2xl px-6 py-10">
          <p className="mb-6 text-sm leading-relaxed text-zinc-500">
            {t("subtitle")}
          </p>
          <AccountForm
            slug={slug}
            initial={{
              name: user.name,
              loginId: user.loginId ?? "",
              email: user.email ?? "",
              phone: user.phone ?? "",
              locale: (user.locale as "en" | "ko") ?? "en",
            }}
          />
        </div>
      </main>
    </OwnerShell>
  );
}
