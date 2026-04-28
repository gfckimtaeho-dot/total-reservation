import { getTranslations } from "next-intl/server";
import { LoginForm } from "@/components/auth/LoginForm";

export default async function LoginPage() {
  const t = await getTranslations("auth");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("login")}</h1>
      <LoginForm />
    </div>
  );
}
