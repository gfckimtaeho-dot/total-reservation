// Auth surface — centered card. Used by /login, /signup/customer, /signup/business.
// (auth) is a route group so its routes live at /login, /signup, etc.
// (no URL prefix), keeping the auth UX minimal and shareable.
export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
