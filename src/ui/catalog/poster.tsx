"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import type { MediaType, PosterColors } from "@/modules/catalog";

export type PosterData = {
  title: string;
  type: MediaType;
  year: number | null;
  posterUrl: string | null;
  posterColors: PosterColors;
  levelRange?: string;
};

const POSTER_WIDTH = 342;
const POSTER_HEIGHT = 513;

export function Poster({
  media,
  sizes = "(max-width: 480px) 45vw, 220px",
}: {
  media: PosterData;
  sizes?: string;
}) {
  const t = useTranslations("poster");
  const kind = t(media.type);
  if (media.posterUrl) {
    return (
      <div className="poster real">
        <Image
          src={media.posterUrl}
          alt={t("posterOf", { title: media.title })}
          width={POSTER_WIDTH}
          height={POSTER_HEIGHT}
          sizes={sizes}
        />
        {media.levelRange ? <span className="lvltag">{media.levelRange}</span> : null}
      </div>
    );
  }
  return (
    <div
      className="poster"
      style={{
        background: `linear-gradient(155deg, ${media.posterColors.c1} 0 58%, ${media.posterColors.c2} 58%)`,
        color: media.posterColors.fg,
      }}
    >
      <span className="pm">
        {kind}
        {media.year ? ` · ${media.year}` : ""}
      </span>
      <span className="strip" />
      <span className="pt">{media.title}</span>
    </div>
  );
}
