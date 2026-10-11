import { redirect } from "next/navigation";
import { LoginScreen } from "@/ui/auth/login-screen";
import { getCurrentUser } from "../../session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return <LoginScreen />;
}
