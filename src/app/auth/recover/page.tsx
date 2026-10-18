import { recoverAction, updatePasswordAction } from "@/app/actions/auth";
import { AuthForm } from "@/components/auth/AuthForm";

export const instant = false;

export default async function RecoverPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams;
  return mode === "reset" ? (
    <AuthForm action={updatePasswordAction} mode="reset" />
  ) : (
    <AuthForm action={recoverAction} mode="recover" />
  );
}
