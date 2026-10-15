import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <div className="picker">
      <div className="col" style={{ gap: 10 }}>
        <h1 style={{ fontSize: 28 }}>{t("title")}</h1>
        <p className="muted">{t("body")}</p>
      </div>
      <Link className="btn" href="/">
        {t("home")}
      </Link>
    </div>
  );
}
