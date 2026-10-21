import { mkdir, writeFile } from "node:fs/promises";
import { z } from "zod";
import { getEnv, hasTmdbCredentials } from "@/infrastructure/config/env";
import { TmdbClient } from "@/infrastructure/tmdb/client";
import { levelGuideEntries } from "@/modules/catalog/infrastructure/level-guide";

const OUTPUT = "data/level-guide-review.csv";

const text = z.string().nullish();
const detailsSchema = z.object({
  name: text,
  title: text,
  original_name: text,
  original_title: text,
  original_language: text,
  first_air_date: text,
  release_date: text,
  vote_average: z.number().nullish(),
  vote_count: z.number().nullish(),
});

const csvCell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;

async function main(): Promise<void> {
  const env = getEnv();
  if (!hasTmdbCredentials(env)) throw new Error("credenciais do TMDB ausentes no .env");
  const client = new TmdbClient({ readAccessToken: env.TMDB_READ_ACCESS_TOKEN, apiKey: env.TMDB_API_KEY });
  const rows = [
    [
      "externalId",
      "levelMin",
      "levelMax",
      "title",
      "originalTitle",
      "language",
      "year",
      "voteAverage",
      "voteCount",
    ],
  ];
  const missing: string[] = [];
  for (const { externalId, range } of levelGuideEntries()) {
    const [kind, id] = externalId.split(":");
    try {
      const work = await client.get(`${kind}/${id}`, { language: "pt-BR" }, detailsSchema);
      rows.push([
        externalId,
        range[0],
        range[1],
        work.name || work.title || "",
        work.original_name || work.original_title || "",
        work.original_language ?? "",
        (work.first_air_date || work.release_date || "").slice(0, 4),
        String(work.vote_average ?? 0),
        String(work.vote_count ?? 0),
      ]);
    } catch {
      missing.push(externalId);
    }
  }
  await mkdir("data", { recursive: true });
  await writeFile(OUTPUT, `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`);
  console.info(`guia de níveis conferido: ${rows.length - 1} obras em ${OUTPUT}`);
  if (missing.length > 0) {
    console.error(`ids sem resposta do TMDB: ${missing.join(", ")}`);
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "falha ao conferir o guia de níveis");
  process.exit(1);
});
