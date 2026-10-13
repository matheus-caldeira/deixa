import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SETUP_CODE_FILE,
  databaseComesFromEnvironment,
  embeddedDatabaseAvailable,
  embeddedDatabaseConfigured,
  findLocalServers,
  getDatabaseStatus,
  verifySetupCode,
  prepareSetupCode,
  serverPlatform,
} from "@/infrastructure/setup";
import { SETUP_COOKIE } from "@/shared/session-cookie";
import { SetupScreen } from "@/ui/setup/setup-screen";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const status = await getDatabaseStatus();
  if (status.state === "ready") redirect("/login");
  prepareSetupCode();
  const unlocked = await verifySetupCode((await cookies()).get(SETUP_COOKIE)?.value);
  return (
    <SetupScreen
      view={{
        unlocked,
        problem: status.state === "unreachable" ? status.reason : null,
        fromEnvironment: databaseComesFromEnvironment(),
        codeFile: SETUP_CODE_FILE,
        platform: serverPlatform(),
        detected: unlocked ? await findLocalServers() : [],
        embedded: embeddedDatabaseAvailable()
          ? embeddedDatabaseConfigured()
            ? "configured"
            : "available"
          : "unsupported",
      }}
    />
  );
}
