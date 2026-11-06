"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { createPlaylistAction } from "@/app/actions/music";
import { MAX_PLAYLIST_TITLE } from "@/modules/music";
import type { MusicHomeView } from "@/operations/views";
import { MusicIcon, PlusIcon } from "../icons";
import { useToast } from "../shell/toast";
import { useErrorText } from "../shell/use-error-text";

export function MusicHomeScreen({ view }: { view: MusicHomeView }) {
  const t = useTranslations("music");
  const router = useRouter();
  const toast = useToast();
  const errorText = useErrorText();
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();

  const create = () =>
    startTransition(async () => {
      const result = await createPlaylistAction({ title }).catch(() => null);
      if (!result?.ok) {
        toast(result?.message ?? errorText(null));
        return;
      }
      setTitle("");
      router.push(`/music/playlist?id=${result.data.playlistId}`);
    });

  return (
    <>
      <div className="sec-h" style={{ paddingTop: 4, alignItems: "center" }}>
        <h1 style={{ fontSize: 28 }}>{t("title")}</h1>
      </div>
      <p className="muted small">{t("intro")}</p>
      <section className="col" style={{ gap: 10 }}>
        {view.playlists.map((playlist) => (
          <Link key={playlist.id} className="card listrow" href={playlist.href}>
            <span className="mic">
              <MusicIcon />
            </span>
            <div className="col" style={{ gap: 2, minWidth: 0 }}>
              <b>{playlist.title}</b>
              <span className="small muted">
                {t("songs", { count: playlist.songCount })}
                {playlist.owned || !playlist.creatorName ? "" : ` · ${playlist.creatorName}`}
              </span>
            </div>
          </Link>
        ))}
      </section>
      <section className="card col" style={{ gap: 10, padding: 14 }}>
        <b>{t("newPlaylist")}</b>
        <div className="field">
          <label htmlFor="playlist-title">{t("playlistName")}</label>
          <input
            id="playlist-title"
            value={title}
            maxLength={MAX_PLAYLIST_TITLE}
            placeholder={t("playlistPlaceholder")}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <button className="btn" onClick={create} disabled={pending || title.trim().length === 0}>
          <PlusIcon width={18} height={18} /> {t("createPlaylist")}
        </button>
      </section>
      <p className="small muted">{t("providerNote", { provider: view.lyricsProvider })}</p>
    </>
  );
}
