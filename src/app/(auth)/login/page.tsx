import { redirect } from "next/navigation";
import { getContainer } from "@/infrastructure/container";
import { LoginScreen, type ShortcutProfile } from "@/ui/auth/login-screen";
import { getCurrentUser } from "../../session";

const SHORTCUT_EMAIL_SUFFIX = "@deixa.example";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  const container = getContainer();
  const profiles: ShortcutProfile[] = [];
  if (container.devShortcuts) {
    for (const user of await container.listShortcutProfiles(SHORTCUT_EMAIL_SUFFIX)) {
      const { tagline, streak } = await container.getTagline(user.id);
      profiles.push({
        email: user.email,
        name: user.name,
        avatarColor: user.avatarColor,
        level: user.level,
        tagline,
        streak,
      });
    }
  }
  return <LoginScreen profiles={profiles} />;
}
