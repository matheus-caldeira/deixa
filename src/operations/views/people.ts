import { z } from "zod";
import type { ComponentProps } from "react";
import { DEFAULT_TIMEZONE } from "@/modules/identity";
import { operation } from "../operation";
import type { PeopleScreen } from "@/ui/people/people-screen";

export const peopleView = {
  "view.people": operation({
    input: z.undefined(),
    run: async (operationContext, _input): Promise<ComponentProps<typeof PeopleScreen>> => {
      const { user, app } = operationContext;

      const people = await Promise.all(
        (await app.listPeople()).map(async (person) => {
          const summary = await app.getProfileSummary({
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

      return {
        people: people.sort((a, b) => b.totalXp - a.totalXp),
      };
    },
  }),
};
