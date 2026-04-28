import { getTranslations } from "next-intl/server";
import { SignupForm } from "@/components/auth/SignupForm";
import { signupBusinessOwner } from "@/lib/auth/actions";

export default async function SignupBusinessPage() {
  const t = await getTranslations("auth");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {t("signup")} · Business owner
      </h1>
      <SignupForm action={signupBusinessOwner} submitLabel={t("signup")} />
    </div>
  );
}
