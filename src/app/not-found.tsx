import Link from "next/link";

export default function NotFound() {
  return (
    <div className="picker">
      <div className="col" style={{ gap: 10 }}>
        <h1 style={{ fontSize: 28 }}>Não encontramos essa página</h1>
        <p className="muted">O episódio pode ainda não ter legenda pronta, ou o endereço mudou.</p>
      </div>
      <Link className="btn" href="/">
        Voltar para o início
      </Link>
    </div>
  );
}
