import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getContainer } from "@/infrastructure/container";
import { pairOf } from "@/modules/identity";
import { isAppError } from "@/shared/errors";
import { ToastProvider } from "@/ui/shell/toast";
import { LessonScreen } from "@/ui/study/lesson-screen";
import { requireUser } from "@/app/session";
import { routes } from "@/shared/routes";

export const dynamic = "force-dynamic";

export default async function PersonalLessonPage(props: {
  searchParams: Promise<{ id?: string; node?: string }>;
}) {
  const user = await requireUser();
  const { id: episodeId = "", node = "" } = await props.searchParams;
  const nodeIndex = Number(node);
  if (!z.uuid().safeParse(episodeId).success || !Number.isInteger(nodeIndex) || nodeIndex < 0) notFound();
  const lesson = await getContainer()
    .startPersonalLesson({
      userId: user.id,
      pair: pairOf(user.preferences),
      level: user.preferences.level,
      episodeId,
      nodeIndex,
    })
    .catch((error: unknown) => {
      if (isAppError(error)) redirect(routes.personalEpisode(episodeId));
      throw error;
    });
  return (
    <ToastProvider>
      <LessonScreen
        key={`${episodeId}:${nodeIndex}`}
        view={{
          episodeId,
          nodeIndex,
          seed: lesson.seed,
          title: lesson.title,
          level: user.preferences.level,
          replay: lesson.replay,
          audioSpeed: user.preferences.audioSpeed,
          exercises: lesson.exercises,
          source: "personal",
          backHref: routes.personalTrail(),
        }}
      />
    </ToastProvider>
  );
}
