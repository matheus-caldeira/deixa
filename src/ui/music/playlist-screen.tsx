"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { addSongAction, removeSongAction, searchLyricsAction } from "@/app/actions/music";
import { MAX_SONG_FIELD } from "@/modules/music";
import type { LyricsCandidateView, PlaylistPageView, SongRowView } from "@/operations/views";
import { BackIcon, MarkerIcon, PlayIcon, PlusIcon, SearchIcon, XIcon } from "../icons";
import { Sheet } from "../shell/sheet";
import { useToast } from "../shell/toast";
import { useErrorText } from "../shell/use-error-text";
import { formatDuration } from "./format-duration";

type LyricsChoice = { kind: "candidate"; id: string } | { kind: "pasted" };

function AddSongSheet({ playlistId, onClose }: { playlistId: string; onClose: () => void }) {
  const t = useTranslations("music.add");
  const router = useRouter();
  const toast = useToast();
  const errorText = useErrorText();
  const [videoUrl, setVideoUrl] = useState("");
  const [artist, setArtist] = useState("");
  const [title, setTitle] = useState("");
  const [candidates, setCandidates] = useState<LyricsCandidateView[] | null>(null);
  const [choice, setChoice] = useState<LyricsChoice | null>(null);
  const [pasting, setPasting] = useState(false);
  const [lrc, setLrc] = useState("");
  const [translationText, setTranslationText] = useState("");
  const [translateWithAi, setTranslateWithAi] = useState(true);
  const [searching, startSearch] = useTransition();
  const [adding, startAdd] = useTransition();

  const search = () =>
    startSearch(async () => {
      const result = await searchLyricsAction({ artist, title }).catch(() => null);
      if (!result?.ok) {
        toast(result?.message ?? errorText(null));
        return;
      }
      setCandidates(result.data);
      setChoice(null);
    });

  const lyricsReady = pasting ? lrc.trim().length > 0 : choice?.kind === "candidate";
  const canAdd = videoUrl.trim() && artist.trim() && title.trim() && lyricsReady;

  const add = () =>
    startAdd(async () => {
      const lyrics = pasting || choice?.kind !== "candidate" ? { lrc } : { lyricsId: choice.id };
      const result = await addSongAction({
        playlistId,
        videoUrl,
        artist,
        title,
        ...lyrics,
        translationText: translationText.trim() || undefined,
        translateWithAi,
      }).catch(() => null);
      if (!result?.ok) {
        toast(result?.message ?? errorText(null));
        return;
      }
      toast(result.data.created ? t("added") : t("alreadyThere"));
      onClose();
      router.refresh();
    });

  return (
    <Sheet label={t("title")} onClose={onClose}>
      <h2 style={{ fontSize: 22 }}>{t("title")}</h2>
      <div className="field">
        <label htmlFor="song-url">{t("videoUrl")}</label>
        <input
          id="song-url"
          inputMode="url"
          autoComplete="off"
          value={videoUrl}
          placeholder="https://www.youtube.com/watch?v=..."
          onChange={(event) => setVideoUrl(event.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="song-artist">{t("artist")}</label>
        <input
          id="song-artist"
          value={artist}
          maxLength={MAX_SONG_FIELD}
          onChange={(event) => setArtist(event.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="song-title">{t("songTitle")}</label>
        <input
          id="song-title"
          value={title}
          maxLength={MAX_SONG_FIELD}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>
      {pasting ? null : (
        <button className="btn" onClick={search} disabled={searching || (!artist.trim() && !title.trim())}>
          <SearchIcon width={18} height={18} /> {searching ? t("searching") : t("searchLyrics")}
        </button>
      )}
      {!pasting && candidates ? (
        candidates.length === 0 ? (
          <p className="muted small">{t("noCandidates")}</p>
        ) : (
          <div
            className="card"
            style={{ padding: "4px 12px" }}
            role="radiogroup"
            aria-label={t("candidates")}
          >
            {candidates.map((candidate) => {
              const usable = candidate.synced && !candidate.instrumental;
              const selected = choice?.kind === "candidate" && choice.id === candidate.id;
              return (
                <div key={candidate.id} className="ep" style={{ gridTemplateColumns: "1fr" }}>
                  <button
                    className="scen"
                    role="radio"
                    aria-checked={selected}
                    disabled={!usable}
                    onClick={() => setChoice({ kind: "candidate", id: candidate.id })}
                    style={{
                      opacity: usable ? 1 : 0.5,
                      outline: selected ? "2px solid var(--brand)" : "none",
                    }}
                  >
                    <span className="col" style={{ gap: 3, minWidth: 0, textAlign: "left" }}>
                      <b>
                        {candidate.artist} · {candidate.title}
                      </b>
                      <span className="small muted">
                        {candidate.durationMs ? formatDuration(candidate.durationMs) : t("unknownDuration")}
                        {" · "}
                        {candidate.instrumental
                          ? t("instrumental")
                          : candidate.synced
                            ? t("synced")
                            : t("notSynced")}
                      </span>
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        )
      ) : null}
      <button className="link small" onClick={() => setPasting((current) => !current)}>
        {pasting ? t("useSearch") : t("pasteLrc")}
      </button>
      {pasting ? (
        <div className="field">
          <label htmlFor="song-lrc">{t("lrcLabel")}</label>
          <textarea
            id="song-lrc"
            rows={6}
            value={lrc}
            placeholder="[00:12.30] ..."
            onChange={(event) => setLrc(event.target.value)}
          />
        </div>
      ) : null}
      <div className="field">
        <label htmlFor="song-translation">{t("translationLabel")}</label>
        <textarea
          id="song-translation"
          rows={4}
          value={translationText}
          onChange={(event) => setTranslationText(event.target.value)}
        />
      </div>
      <label className="row small" style={{ gap: 8, alignItems: "center" }}>
        <input
          type="checkbox"
          checked={translateWithAi}
          onChange={(event) => setTranslateWithAi(event.target.checked)}
        />
        {t("translateWithAi")}
      </label>
      <button className="btn block" onClick={add} disabled={!canAdd || adding}>
        {adding ? t("adding") : t("submit")}
      </button>
    </Sheet>
  );
}

function SongRow({ song, canEdit }: { song: SongRowView; canEdit: boolean }) {
  const t = useTranslations("music");
  const router = useRouter();
  const toast = useToast();
  const errorText = useErrorText();
  const [pending, startTransition] = useTransition();

  const remove = () => {
    if (!window.confirm(t("removeConfirm", { title: song.title }))) return;
    startTransition(async () => {
      const result = await removeSongAction({ episodeId: song.episodeId }).catch(() => null);
      if (!result?.ok) {
        toast(result?.message ?? errorText(null));
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="card songrow" data-testid="song-row">
      <div className="songthumb">
        <Image src={song.thumbnailUrl} alt="" width={320} height={180} sizes="96px" />
      </div>
      <div className="col" style={{ gap: 3, minWidth: 0 }}>
        <b style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{song.title}</b>
        <span
          className="small muted"
          style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >
          {song.artist}
          {song.durationMs ? ` · ${formatDuration(song.durationMs)}` : ""}
        </span>
        <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
          {song.status === "READY" ? (
            <span className="chip good">{t("lines", { count: song.cueCount })}</span>
          ) : (
            <span className="chip warn">{t(`status.${song.status}`)}</span>
          )}
          {song.hasTranslation ? (
            <span className="chip">{song.translationSource === "llm" ? t("sourceAi") : t("translated")}</span>
          ) : null}
        </div>
      </div>
      <div className="col" style={{ gap: 6, alignItems: "center" }}>
        <Link className="playbtn" href={song.listenHref} aria-label={t("listen", { title: song.title })}>
          <PlayIcon />
        </Link>
        {song.readHref ? (
          <Link className="iconbtn" href={song.readHref} aria-label={t("readAndMark")}>
            <MarkerIcon />
          </Link>
        ) : null}
        {canEdit ? (
          <button className="iconbtn" onClick={remove} disabled={pending} aria-label={t("remove")}>
            <XIcon />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function PlaylistScreen({ view }: { view: PlaylistPageView }) {
  const t = useTranslations("music");
  const [adding, setAdding] = useState(false);
  return (
    <>
      <div className="sec-h" style={{ paddingTop: 4, alignItems: "center", gap: 10 }}>
        <Link className="iconbtn" href={view.backHref} aria-label={t("back")}>
          <BackIcon />
        </Link>
        <h1 style={{ fontSize: 24, flex: 1, minWidth: 0 }}>{view.title}</h1>
        {view.canEdit ? (
          <button
            className="playbtn"
            onClick={() => setAdding(true)}
            aria-label={t("addSong")}
            aria-haspopup="dialog"
          >
            <PlusIcon />
          </button>
        ) : null}
      </div>
      {view.songs.length === 0 ? (
        <div className="card col" style={{ gap: 8, padding: 16 }}>
          <b>{t("emptyTitle")}</b>
          <span className="small muted">{view.canEdit ? t("emptyOwner") : t("emptyGuest")}</span>
        </div>
      ) : (
        <section className="col" style={{ gap: 10 }}>
          {view.songs.map((song) => (
            <SongRow key={song.episodeId} song={song} canEdit={view.canEdit} />
          ))}
        </section>
      )}
      {adding ? <AddSongSheet playlistId={view.id} onClose={() => setAdding(false)} /> : null}
    </>
  );
}
