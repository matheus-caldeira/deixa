"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { importPackageAction } from "@/app/actions/transfer";
import type { ImportReport, PackagePreview } from "@/modules/packages";
import { CheckIcon } from "../icons";
import { useToast } from "../shell/toast";

export type TransferWork = {
  id: string;
  title: string;
  type: "series" | "movie";
  seasons: {
    seasonNumber: number;
    episodes: { id: string; episodeNumber: number; title: string; ready: boolean }[];
  }[];
};

export type TransferView = { works: TransferWork[]; selectedMediaId: string | null; passwordError: boolean };

type ExportScope = "me" | "work" | "season" | "episode";
type ImportStage =
  { step: "pick" } | { step: "preview"; preview: PackagePreview } | { step: "done"; report: ImportReport };

const SCOPES: { key: ExportScope; label: string }[] = [
  { key: "me", label: "Meus dados" },
  { key: "work", label: "Obra" },
  { key: "season", label: "Temporada" },
  { key: "episode", label: "Episódio" },
];

function Pick({
  on,
  title,
  detail,
  onToggle,
}: {
  on: boolean;
  title: string;
  detail: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={`result ${on ? "on" : ""}`}
      style={{ gridTemplateColumns: "1fr 22px" }}
      onClick={onToggle}
      aria-pressed={on}
    >
      <span className="col" style={{ gap: 2, minWidth: 0 }}>
        <b>{title}</b>
        <span className="small muted">{detail}</span>
      </span>
      <span style={{ width: 22, height: 22, color: "var(--brand)" }}>{on ? <CheckIcon /> : null}</span>
    </button>
  );
}

function ExportCard({ view }: { view: TransferView }) {
  const [scope, setScope] = useState<ExportScope>(view.selectedMediaId ? "work" : "me");
  const [includeKeys, setIncludeKeys] = useState(false);
  const [mediaId, setMediaId] = useState(view.selectedMediaId ?? view.works[0]?.id ?? "");
  const work = view.works.find((candidate) => candidate.id === mediaId) ?? null;
  const [seasonNumber, setSeasonNumber] = useState<number>(work?.seasons[0]?.seasonNumber ?? 0);
  const season =
    work?.seasons.find((candidate) => candidate.seasonNumber === seasonNumber) ?? work?.seasons[0] ?? null;
  const [episodeId, setEpisodeId] = useState(season?.episodes[0]?.id ?? "");
  const [options, setOptions] = useState({ subtitles: true, cards: true, audio: false });
  const toggle = (key: keyof typeof options) =>
    setOptions((current) => ({ ...current, [key]: !current[key] }));
  const params = new URLSearchParams({ kind: scope, mediaId });
  if (scope === "season") params.set("seasonNumber", String(season?.seasonNumber ?? 0));
  if (scope === "episode") params.set("episodeId", episodeId || (season?.episodes[0]?.id ?? ""));
  for (const [key, on] of Object.entries(options)) if (on) params.set(key, "1");
  const ready = Boolean(work) && (scope !== "episode" || Boolean(params.get("episodeId")));

  const personal = (
    <form className="col" style={{ gap: 14 }} method="post" action="/api/transfer/export-personal">
      <p className="small muted">
        Preferências, progresso, marcações, seus cards com o estado de revisão, histórico e XP. Entram na
        conta que importar.
      </p>
      <div className="field">
        <label>Chaves de API</label>
        <div className="seg" role="radiogroup" aria-label="Chaves de API">
          <button type="button" className={includeKeys ? "" : "on"} onClick={() => setIncludeKeys(false)}>
            Sem as chaves
          </button>
          <button type="button" className={includeKeys ? "on" : ""} onClick={() => setIncludeKeys(true)}>
            Com as chaves
          </button>
        </div>
        <span className="small muted">Com as chaves, elas entram cifradas junto com os seus dados.</span>
      </div>
      <input type="hidden" name="includeCredentials" value={includeKeys ? "true" : "false"} />
      <div className="field">
        <label htmlFor="export-password">Sua senha</label>
        <input
          id="export-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        <span className="small muted">
          Os dados pessoais saem cifrados com o seu e-mail e a sua senha. Sem a senha, o arquivo não abre.
        </span>
      </div>
      {view.passwordError ? <p className="formerr">Senha incorreta. Tente de novo.</p> : null}
      <button className="btn block" type="submit">
        Exportar .deixa.zip
      </button>
    </form>
  );

  return (
    <section className="card col" style={{ gap: 14 }} id="exportar">
      <h2 style={{ fontSize: 17 }}>Exportar</h2>
      <div className="seg" role="radiogroup" aria-label="Alcance da exportação">
        {SCOPES.map((option) => (
          <button
            key={option.key}
            type="button"
            className={scope === option.key ? "on" : ""}
            onClick={() => setScope(option.key)}
            disabled={
              (option.key === "season" || option.key === "episode") && (!work || work.type === "movie")
            }
          >
            {option.label}
          </button>
        ))}
      </div>
      {scope === "me" ? (
        personal
      ) : view.works.length === 0 ? (
        <p className="small muted">O catálogo ainda está vazio. Adicione uma obra antes de exportar.</p>
      ) : (
        <>
          <div className="field">
            <label htmlFor="export-work">Obra</label>
            <select
              id="export-work"
              value={mediaId}
              onChange={(event) => {
                setMediaId(event.target.value);
                const next = view.works.find((candidate) => candidate.id === event.target.value);
                setSeasonNumber(next?.seasons[0]?.seasonNumber ?? 0);
                setEpisodeId(next?.seasons[0]?.episodes[0]?.id ?? "");
              }}
            >
              {view.works.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.title}
                </option>
              ))}
            </select>
          </div>
          {scope !== "work" && work ? (
            <div className="row" style={{ alignItems: "flex-start" }}>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="export-season">Temporada</label>
                <select
                  id="export-season"
                  value={season?.seasonNumber ?? 0}
                  onChange={(event) => {
                    const number = Number(event.target.value);
                    setSeasonNumber(number);
                    const next = work.seasons.find((candidate) => candidate.seasonNumber === number);
                    setEpisodeId(next?.episodes[0]?.id ?? "");
                  }}
                >
                  {work.seasons.map((candidate) => (
                    <option key={candidate.seasonNumber} value={candidate.seasonNumber}>
                      {candidate.seasonNumber}
                    </option>
                  ))}
                </select>
              </div>
              {scope === "episode" && season ? (
                <div className="field" style={{ flex: 1 }}>
                  <label htmlFor="export-episode">Episódio</label>
                  <select
                    id="export-episode"
                    value={episodeId}
                    onChange={(event) => setEpisodeId(event.target.value)}
                  >
                    {season.episodes.map((episode) => (
                      <option key={episode.id} value={episode.id}>
                        {episode.episodeNumber}
                        {episode.ready ? "" : " (sem legenda)"}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="col" style={{ gap: 8 }}>
            <span className="eyebrow">O que entra no pacote</span>
            <Pick
              on={options.subtitles}
              title="Legendas"
              detail="Os arquivos .srt em inglês e português."
              onToggle={() => toggle("subtitles")}
            />
            <Pick
              on={options.cards}
              title="Cards do catálogo"
              detail="Itens e explicações compartilhados. Cards privados não saem."
              onToggle={() => toggle("cards")}
            />
            <Pick
              on={options.audio}
              title="Áudios gerados"
              detail="Pode passar de centenas de MB por temporada."
              onToggle={() => toggle("audio")}
            />
          </div>
          <p className="note">
            Legendas e áudio de obras reais têm direitos autorais. Use o pacote como cópia pessoal.
          </p>
          <a
            className={`btn block ${ready ? "" : "disabled"}`}
            href={ready ? `/api/transfer/export?${params}` : undefined}
            download
          >
            Exportar .deixa.zip
          </a>
        </>
      )}
    </section>
  );
}

function ImportCard() {
  const router = useRouter();
  const toast = useToast();
  const [stage, setStage] = useState<ImportStage>({ step: "pick" });
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [, startTransition] = useTransition();

  const inspect = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/transfer/import", { method: "POST", body: form });
      const body = (await response.json()) as
        { ok: true; data: PackagePreview } | { ok: false; message: string };
      if (!body.ok) {
        setError(body.message);
        return;
      }
      setStage({ step: "preview", preview: body.data });
    } catch {
      setError("Não foi possível enviar o arquivo. Tente de novo.");
    } finally {
      setBusy(false);
    }
  };

  const confirm = (preview: PackagePreview) =>
    startTransition(async () => {
      setBusy(true);
      setError("");
      const result = await importPackageAction({
        uploadId: preview.uploadId,
        password: preview.personal && password.trim() !== "" ? password : undefined,
      });
      setBusy(false);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setStage({ step: "done", report: result.data });
      toast("Importação concluída.");
      router.refresh();
    });

  return (
    <section className="card col" style={{ gap: 14 }} id="importar">
      <h2 style={{ fontSize: 17 }}>Importar</h2>
      {stage.step === "pick" ? (
        <label className="slot">
          <span className="ic">ZIP</span>
          <span className="col" style={{ gap: 2 }}>
            <b>{busy ? "Lendo o arquivo…" : "Escolher arquivo .deixa.zip"}</b>
            <span className="small muted">
              O arquivo já traz tudo o que é preciso. Nada é gravado antes de você conferir.
            </span>
          </span>
          <input
            type="file"
            accept=".zip,application/zip"
            style={{ display: "none" }}
            disabled={busy}
            onChange={(event) => void inspect(event.target.files?.[0])}
            aria-label="Arquivo do pacote"
          />
        </label>
      ) : null}
      {stage.step === "preview" ? (
        <>
          <dl className="kv">
            <dt>Origem</dt>
            <dd>
              {stage.preview.app} · {new Date(stage.preview.generatedAt).toLocaleDateString("pt-BR")}
            </dd>
          </dl>
          <div>
            <span className="eyebrow">O que vai entrar</span>
            {stage.preview.works.map((work) => (
              <div key={work.title}>
                <div className="dueitem">
                  <span className="col" style={{ gap: 2 }}>
                    <b>{work.title}</b>
                    <span className="small muted">
                      {work.status === "new" ? "Obra nova no catálogo" : "Já está no catálogo"}
                    </span>
                  </span>
                </div>
                {work.episodes.map((episode) => (
                  <div key={episode.label} className="dueitem">
                    <span className="col" style={{ gap: 2 }}>
                      <span>
                        {episode.label} · {episode.title}
                      </span>
                      <span className="small muted">
                        {episode.subtitles > 0 ? `${episode.subtitles} legenda(s)` : "sem legenda"}
                        {episode.cards > 0 ? ` · ${episode.cards} cards` : ""}
                      </span>
                    </span>
                    <span
                      className={`chip ${episode.status === "new" ? "good" : ""}`}
                      style={{ alignSelf: "start" }}
                    >
                      {episode.status === "new" ? "Novo" : "Já existe"}
                    </span>
                  </div>
                ))}
              </div>
            ))}
            {stage.preview.audio > 0 ? (
              <div className="dueitem">
                <span>Áudios</span>
                <b>{stage.preview.audio}</b>
              </div>
            ) : null}
            {stage.preview.personal ? (
              <div className="dueitem">
                <span className="col" style={{ gap: 2 }}>
                  <b>Dados pessoais</b>
                  <span className="small muted">
                    De {stage.preview.personal.email}, cifrados. Entram na conta conectada
                    {stage.preview.personal.includesCredentials ? ", com as chaves de API" : ""}.
                  </span>
                </span>
                <span className="chip warn" style={{ alignSelf: "start" }}>
                  Pede senha
                </span>
              </div>
            ) : null}
          </div>
          {stage.preview.personal ? (
            <div className="field">
              <label htmlFor="import-password">Senha de {stage.preview.personal.email}</label>
              <input
                id="import-password"
                type="password"
                autoComplete="off"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <span className="small muted">
                Sem a senha, os dados pessoais ficam de fora e o resto entra normalmente.
              </span>
            </div>
          ) : null}
          <div className="row">
            <button
              className="btn ghost"
              style={{ padding: "12px 14px", fontSize: 13 }}
              onClick={() => setStage({ step: "pick" })}
              disabled={busy}
            >
              Cancelar
            </button>
            <button
              className="btn"
              style={{ padding: "12px 14px", fontSize: 13, flex: 1 }}
              onClick={() => confirm(stage.preview)}
              disabled={busy}
            >
              {busy ? "Importando…" : "Importar"}
            </button>
          </div>
        </>
      ) : null}
      {stage.step === "done" ? (
        <>
          <div className="row">
            <span style={{ width: 28, height: 28, color: "var(--good)", flex: "none" }}>
              <CheckIcon />
            </span>
            <b>Importação concluída</b>
          </div>
          <div>
            <div className="dueitem">
              <span>Obras novas</span>
              <b>{stage.report.worksCreated}</b>
            </div>
            <div className="dueitem">
              <span>Episódios com legenda nova</span>
              <b>{stage.report.episodesImported}</b>
            </div>
            <div className="dueitem">
              <span>Cards sugeridos no catálogo</span>
              <b>{stage.report.cards}</b>
            </div>
            <div className="dueitem">
              <span>Áudios</span>
              <b>{stage.report.audio}</b>
            </div>
            <div className="dueitem">
              <span className="muted">Episódios que já existiam</span>
              <b className="muted">{stage.report.episodesSkipped}</b>
            </div>
            {stage.report.personal ? (
              <div className="dueitem">
                <span className="col" style={{ gap: 2 }}>
                  <span>Dados pessoais</span>
                  <span className="small muted">
                    {stage.report.personal.cards} cards, {stage.report.personal.highlights} marcações,{" "}
                    {stage.report.personal.progress} episódios em andamento, {stage.report.personal.xp}{" "}
                    eventos de XP
                    {stage.report.personal.credentials > 0
                      ? `, ${stage.report.personal.credentials} chaves`
                      : ""}
                    {stage.report.personal.skipped > 0
                      ? `; ${stage.report.personal.skipped} itens sem episódio aqui`
                      : ""}
                  </span>
                </span>
              </div>
            ) : null}
          </div>
          {stage.report.warnings.length > 0 ? (
            <ul className="small muted" style={{ paddingLeft: 18 }}>
              {stage.report.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
          <button
            className="btn ghost"
            style={{ padding: 10, fontSize: 13 }}
            onClick={() => setStage({ step: "pick" })}
          >
            Importar outro arquivo
          </button>
        </>
      ) : null}
      {error ? <p className="formerr">{error}</p> : null}
      <p className="small muted">
        O que já existe não é sobrescrito. Importar o mesmo arquivo duas vezes não duplica nada.
      </p>
    </section>
  );
}

export function TransferScreen({ view }: { view: TransferView }) {
  return (
    <>
      <h1 style={{ fontSize: 28, paddingTop: 4 }}>Importar e exportar</h1>
      <p className="muted">
        Leve conteúdo de uma instalação para outra ou guarde uma cópia de segurança do catálogo.
      </p>
      <div className="col" style={{ gap: 18, maxWidth: 640, width: "100%" }}>
        <ImportCard />
        <ExportCard view={view} />
      </div>
    </>
  );
}
