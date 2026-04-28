import { getTranslations } from "next-intl/server";
import { SignupForm } from "@/components/auth/SignupForm";
import { signupCustomer } from "@/lib/auth/actions";

export default async function SignupCustomerPage() {
  const t = await getTranslations("auth");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {t("signup")} · Customer
      </h1>
      <SignupForm action={signupCustomer} submitLabel={t("signup")} />
    </div>
  );
}
