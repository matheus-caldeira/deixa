import { getContainer } from "@/infrastructure/container";
import { DEFAULT_TIMEZONE } from "@/modules/identity";
import { PeopleScreen } from "@/ui/people/people-screen";
import { requireUser } from "../../session";

export default async function PeoplePage() {
  const user = await requireUser();
  const container = getContainer();
  const people = await Promise.all(
    (await container.listPeople()).map(async (person) => {
      const summary = await container.getProfileSummary({
        userId: person.id,
        dailyGoal: 0,
        timezone: DEFAULT_TIMEZONE,
      });
      return {
        id: person.id,
        name: person.name,
        avatarColor: person.avatarColor,
        level: person.level,
        streak: summary.streak,
        totalXp: summary.totalXp,
        xpToday: summary.xpToday,
        isYou: person.id === user.id,
      };
    }),
  );
  return <PeopleScreen people={people.sort((a, b) => b.totalXp - a.totalXp)} />;
}
