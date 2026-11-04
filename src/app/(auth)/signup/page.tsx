import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SETUP_CODE_FILE, isSetupCode, prepareFirstAccountCode } from "@/infrastructure/setup";
import { SETUP_COOKIE } from "@/shared/session-cookie";
import { SignupScreen } from "@/ui/auth/signup-screen";
import { getCurrentUser } from "../../session";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/");
  const firstAccount = await prepareFirstAccountCode();
  const unlocked = isSetupCode((await cookies()).get(SETUP_COOKIE)?.value);
  return <SignupScreen setupCodeFile={firstAccount && !unlocked ? SETUP_CODE_FILE : null} />;
}
