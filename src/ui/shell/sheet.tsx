"use client";

import { useEffect } from "react";
import { XIcon } from "../icons";

export function Sheet({
  label,
  onClose,
  children,
}: {
  label: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.documentElement.classList.add("sheet-open");
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.classList.remove("sheet-open");
    };
  }, [onClose]);

  return (
    <div
      className="scrim"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label}>
        <div className="sheet-top">
          <span style={{ width: 36 }} />
          <div className="grab" />
          <button className="iconbtn" onClick={onClose} aria-label="Fechar">
            <XIcon />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
