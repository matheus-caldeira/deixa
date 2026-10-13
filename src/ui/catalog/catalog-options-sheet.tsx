"use client";

import Link from "next/link";
import { BackIcon, PlusIcon, SwapIcon, UploadIcon } from "../icons";
import { Sheet } from "../shell/sheet";

export function CatalogOptionsSheet({
  title,
  mediaId,
  onAdd,
  onClose,
}: {
  title: string;
  mediaId?: string;
  onAdd: () => void;
  onClose: () => void;
}) {
  const exportHref = mediaId ? `/transfer?mediaId=${mediaId}#exportar` : "/transfer#exportar";
  const row = (icon: React.ReactNode, label: string, detail: string) => (
    <>
      <span className="ic">{icon}</span>
      <span className="col" style={{ gap: 3, minWidth: 0 }}>
        <b>{label}</b>
        <span className="small muted">{detail}</span>
      </span>
      <span style={{ color: "var(--muted)", width: 20, transform: "rotate(180deg)" }}>
        <BackIcon />
      </span>
    </>
  );
  return (
    <Sheet label={title} onClose={onClose}>
      <h2 style={{ fontSize: 22 }}>{title}</h2>
      <div className="card" style={{ padding: "4px 16px" }}>
        <div className="ep" style={{ gridTemplateColumns: "1fr" }}>
          <button className="scen" onClick={onAdd}>
            {row(
              <PlusIcon />,
              "Adicionar",
              mediaId
                ? "Envie ou busque a legenda de outro episódio."
                : "Busque a obra e envie ou busque a legenda do episódio.",
            )}
          </button>
        </div>
        <div className="ep" style={{ gridTemplateColumns: "1fr" }}>
          <Link className="scen" href="/transfer#importar" onClick={onClose}>
            {row(<UploadIcon />, "Importar", "De um arquivo .deixa.zip com obras, legendas, cards e áudio.")}
          </Link>
        </div>
        <div className="ep" style={{ gridTemplateColumns: "1fr" }}>
          <Link className="scen" href={exportHref} onClick={onClose}>
            {row(
              <SwapIcon />,
              "Exportar",
              mediaId
                ? "Gerar um pacote desta obra, de uma temporada ou de um episódio."
                : "Gerar um pacote de uma obra, temporada ou episódio.",
            )}
          </Link>
        </div>
      </div>
    </Sheet>
  );
}
