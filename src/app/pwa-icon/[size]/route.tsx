import { ImageResponse } from "next/og";
import { APP_LOGO_SPLIT, APP_NAME } from "@/shared/app";

const ALLOWED_SIZES = [180, 192, 512];
const INK = "#0E1018";
const CUE = "#FFC63A";
const PAPER = "#EDEFF7";

export async function GET(
  _request: Request,
  context: { params: Promise<{ size: string }> },
): Promise<Response> {
  const size = Number((await context.params).size);
  if (!ALLOWED_SIZES.includes(size)) return new Response(null, { status: 404 });
  const fontSize = Math.round(size * 0.3);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: INK,
        color: PAPER,
        fontSize,
        fontWeight: 800,
        letterSpacing: -fontSize * 0.04,
      }}
    >
      <span>{APP_NAME.slice(0, APP_LOGO_SPLIT)}</span>
      <span
        style={{
          background: "#000",
          color: CUE,
          padding: `0 ${Math.round(size * 0.03)}px`,
          borderRadius: Math.round(size * 0.05),
          marginLeft: Math.round(size * 0.01),
        }}
      >
        {APP_NAME.slice(APP_LOGO_SPLIT)}
      </span>
    </div>,
    { width: size, height: size },
  );
}
