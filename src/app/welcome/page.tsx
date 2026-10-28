import { redirect } from "next/navigation";
import { LandingScreen } from "@/ui/landing/landing-screen";
import { getCurrentUser } from "../session";

export const dynamic = "force-dynamic";

export default async function WelcomePage() {
  if (await getCurrentUser()) redirect("/");
  return <LandingScreen />;
}
