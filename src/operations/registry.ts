import { accountOperations } from "./accounts";
import { aiSettingsOperations } from "./ai-settings";
import { audioOperations } from "./audio";
import { catalogOperations } from "./catalog";
import { levelSourceOperations } from "./level-sources";
import { musicOperations } from "./music";
import { musicViews } from "./views/music";
import { notificationOperations } from "./notifications";
import { personalSeriesOperations } from "./personal-series";
import { pronunciationOperations } from "./pronunciation";
import { profileOperations } from "./profile";
import { readingOperations } from "./reading";
import { recommendationOperations } from "./recommendations";
import { reviewOperations } from "./review";
import { studyOperations } from "./study";
import { transferOperations } from "./transfer";
import { tutorOperations } from "./tutor";
import { homeViews } from "./views/home";
import { shellViews } from "./views/shell";
import { trailView } from "./views/trail";
import { reviewView } from "./views/review";
import { tmdbView } from "./views/tmdb";
import { workView } from "./views/work";
import { transferView } from "./views/transfer";
import { peopleView } from "./views/people";
import { conversationReviewView } from "./views/conversationReview";
import { conversationView } from "./views/conversation";
import { studyView } from "./views/study";
import { personalLessonView } from "./views/personalLesson";
import { recapView } from "./views/recap";
import { readView } from "./views/read";
import { tutorView } from "./views/tutor";
import { settingsView } from "./views/settings";
import { accountsView } from "./views/accounts";
import { seriesView } from "./views/series";
import { seriesEpisodeView } from "./views/seriesEpisode";
import { progressView } from "./views/progress";
import { catalogView } from "./views/catalog";

export const OPERATION_GROUPS = [
  accountOperations,
  aiSettingsOperations,
  catalogOperations,
  levelSourceOperations,
  musicOperations,
  musicViews,
  notificationOperations,
  personalSeriesOperations,
  profileOperations,
  readingOperations,
  recommendationOperations,
  reviewOperations,
  studyOperations,
  transferOperations,
  tutorOperations,
  shellViews,
  homeViews,
  catalogView,
  progressView,
  seriesEpisodeView,
  seriesView,
  settingsView,
  accountsView,
  tutorView,
  readView,
  recapView,
  personalLessonView,
  studyView,
  conversationView,
  conversationReviewView,
  peopleView,
  transferView,
  workView,
  tmdbView,
  reviewView,
  trailView,
  audioOperations,
  pronunciationOperations,
];

export const OPERATIONS = {
  ...accountOperations,
  ...aiSettingsOperations,
  ...catalogOperations,
  ...levelSourceOperations,
  ...musicOperations,
  ...musicViews,
  ...notificationOperations,
  ...personalSeriesOperations,
  ...profileOperations,
  ...readingOperations,
  ...recommendationOperations,
  ...reviewOperations,
  ...studyOperations,
  ...transferOperations,
  ...tutorOperations,
  ...shellViews,
  ...homeViews,
  ...catalogView,
  ...progressView,
  ...seriesEpisodeView,
  ...seriesView,
  ...settingsView,
  ...accountsView,
  ...tutorView,
  ...readView,
  ...recapView,
  ...personalLessonView,
  ...studyView,
  ...conversationView,
  ...conversationReviewView,
  ...peopleView,
  ...transferView,
  ...workView,
  ...tmdbView,
  ...reviewView,
  ...trailView,
  ...audioOperations,
  ...pronunciationOperations,
};

export type Operations = typeof OPERATIONS;
export type OperationName = keyof Operations;
export type OperationOutput<Name extends OperationName> = Operations[Name] extends {
  run: (...args: never[]) => Promise<infer Output>;
}
  ? Output
  : never;
