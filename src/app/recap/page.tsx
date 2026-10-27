import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getContainer } from "@/infrastructure/container";
import { pairOf } from "@/modules/identity";
import { RECAP_STEPS } from "@/modules/study";
import { isAppError } from "@/shared/errors";
import { RecapScreen } from "@/ui/review/recap-screen";
import { ToastProvider } from "@/ui/shell/toast";
import { requireUser } from "@/app/session";

export const dynamic = "force-dynamic";

export default async function RecapPage(props: { searchParams: Promise<{ id?: string }> }) {
  const user = await requireUser();
  const { id: recapId = "" } = await props.searchParams;
  if (!z.uuid().safeParse(recapId).success) notFound();
  const lesson = await getContainer()
    .startRecap({ userId: user.id, pair: pairOf(user.preferences), level: user.preferences.level, recapId })
    .catch((error: unknown) => {
      if (isAppError(error)) redirect("/review?tab=episodes");
      throw error;
    });
  return (
    <ToastProvider>
      <RecapScreen
        view={{
          recapId,
          step: lesson.step + 1,
          steps: RECAP_STEPS,
          due: lesson.due,
          workTitle: lesson.info.workTitle,
          label: lesson.info.label,
          title: lesson.info.title,
          summary: lesson.info.summary,
          cards: lesson.info.cards,
          lesson: {
            episodeId: recapId,
            nodeIndex: 0,
            seed: lesson.seed,
            title: lesson.info.title,
            level: user.preferences.level,
            replay: !lesson.due,
            audioSpeed: user.preferences.audioSpeed,
            exercises: lesson.exercises,
            source: lesson.recap.source === "personal" ? "recap-personal" : "recap",
            backHref: "/review?tab=episodes",
          },
        }}
      />
    </ToastProvider>
  );
}
