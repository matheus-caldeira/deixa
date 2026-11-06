import type { LyricsCandidate, LyricsDocument, LyricsProvider, LyricsQuery } from "../application/ports";
import { MAX_SEARCH_RESULTS } from "../domain/music";

type FakeSong = {
  id: string;
  artist: string;
  title: string;
  album: string;
  durationMs: number;
  lrc: string;
};

const FAKE_SONGS: readonly FakeSong[] = [
  {
    id: "fake-1",
    artist: "Lanterna Azul",
    title: "Morning Window",
    album: "Small Rooms",
    durationMs: 52_000,
    lrc: `[ar:Lanterna Azul]
[ti:Morning Window]
[00:04.00]The light comes in through the window
[00:08.50]And I am still in my coat
[00:13.00]We said we would leave by sunrise
[00:17.50]But the coffee is getting cold
[00:22.00]
[00:26.00]So let it be a slow day
[00:30.50]Let the kettle sing along
[00:35.00]Nobody here is counting
[00:39.50]We are right where we belong
[00:48.00]
`,
  },
  {
    id: "fake-2",
    artist: "Lanterna Azul",
    title: "Paper Boats",
    album: "Small Rooms",
    durationMs: 48_000,
    lrc: `[ar:Lanterna Azul]
[ti:Paper Boats]
[00:03.20]I folded all my worries
[00:07.40]Into little paper boats
[00:11.60]Sent them down the rainy gutter
[00:15.80]Watched them wobble and float
[00:20.00]
[00:23.00][00:35.00]Float away, float away
[00:27.20][00:39.20]Nothing here will make me stay
[00:31.00]The river knows the way
[00:43.50]
`,
  },
  {
    id: "fake-3",
    artist: "Rio Cinza",
    title: "Last Train Home",
    album: "Night Shift",
    durationMs: 50_000,
    lrc: `[ar:Rio Cinza]
[ti:Last Train Home]
[00:05.00]The platform is empty tonight
[00:09.50]Only the wind keeps me company
[00:14.00]I count the lights in the distance
[00:18.50]And wonder if you wait for me
[00:23.00]
[00:27.00]Take me home, take me home
[00:31.50]On the last train going slow
[00:36.00]Take me home, take me home
[00:40.50]Where the porch lights always glow
[00:48.00]
`,
  },
  {
    id: "fake-4",
    artist: "Rio Cinza",
    title: "Say It Plain",
    album: "Night Shift",
    durationMs: 46_000,
    lrc: `[ar:Rio Cinza]
[ti:Say It Plain]
[00:04.00]You do not have to be clever
[00:08.00]You do not have to be loud
[00:12.00]Just say it plain, say it plain
[00:16.00]I will listen to you now
[00:20.00]
[00:24.00]Every word that you are holding
[00:28.00]Is a bridge between us two
[00:32.00]Say it plain, say it plain
[00:36.00]I am already with you
[00:44.00]
`,
  },
];

const candidateOf = (song: FakeSong): LyricsCandidate => ({
  id: song.id,
  artist: song.artist,
  title: song.title,
  album: song.album,
  durationMs: song.durationMs,
  synced: true,
  instrumental: false,
});

const normalize = (text: string): string => text.toLowerCase().trim();

export class FakeLyricsProvider implements LyricsProvider {
  readonly name = "fake" as const;

  async search(query: LyricsQuery): Promise<LyricsCandidate[]> {
    const terms = [query.query, query.artist, query.title]
      .map((term) => normalize(term ?? ""))
      .filter(Boolean);
    return FAKE_SONGS.filter((song) => {
      const haystack = normalize(`${song.artist} ${song.title}`);
      return terms.every((term) => haystack.includes(term));
    })
      .slice(0, MAX_SEARCH_RESULTS)
      .map(candidateOf);
  }

  async get(id: string): Promise<LyricsDocument | null> {
    const song = FAKE_SONGS.find((candidate) => candidate.id === id);
    return song ? { ...candidateOf(song), syncedLrc: song.lrc, plain: null } : null;
  }
}

export const FAKE_SONG_IDS = FAKE_SONGS.map((song) => song.id);
