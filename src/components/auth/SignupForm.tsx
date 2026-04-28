"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AuthState } from "@/lib/auth/actions";

interface SignupFormProps {
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
  submitLabel: string;
}

const initial: AuthState = {};

export function SignupForm({ action, submitLabel }: SignupFormProps) {
  const t = useTranslations("auth");
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">{t("name")}</Label>
        <Input id="name" name="name" required />
        {state.errors?.name && (
          <p className="text-sm text-red-600">{state.errors.name[0]}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">{t("email")}</Label>
        <Input id="email" name="email" type="email" required />
        {state.errors?.email && (
          <p className="text-sm text-red-600">{state.errors.email[0]}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">{t("password")}</Label>
        <Input id="password" name="password" type="password" required minLength={8} />
        {state.errors?.password && (
          <p className="text-sm text-red-600">{state.errors.password[0]}</p>
        )}
      </div>
      {state.message && (
        <p className="text-sm text-red-600">{state.message}</p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "..." : submitLabel}
      </Button>
    </form>
  );
}
