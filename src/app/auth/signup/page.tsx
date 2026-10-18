import { signupAction } from "@/app/actions/auth";
import { AuthForm } from "@/components/auth/AuthForm";

export default function SignupPage() {
  return <AuthForm action={signupAction} mode="signup" />;
}
