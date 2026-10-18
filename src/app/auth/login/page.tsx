import { loginAction } from "@/app/actions/auth";
import { AuthForm } from "@/components/auth/AuthForm";
import { safeReturnPath } from "@/features/auth/authorization";

export const instant = false;

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <AuthForm action={loginAction} mode="login" next={safeReturnPath(next)} />;
}
