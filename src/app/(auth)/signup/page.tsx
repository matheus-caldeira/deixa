import { redirect } from "next/navigation";
import { SignupScreen } from "@/ui/auth/signup-screen";
import { getCurrentUser } from "../../session";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/");
  return <SignupScreen />;
}
