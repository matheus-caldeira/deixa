import { APP_LOGO_SPLIT, APP_NAME } from "@/shared/app";

export function Logo() {
  return (
    <div className="logo" aria-label={APP_NAME}>
      {APP_NAME.slice(0, APP_LOGO_SPLIT)}
      <span>{APP_NAME.slice(APP_LOGO_SPLIT)}</span>
    </div>
  );
}
