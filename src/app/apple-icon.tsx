import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#000000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fcd34d",
          fontSize: 112,
          fontWeight: 700,
          letterSpacing: "-0.05em",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        예
      </div>
    ),
    { ...size },
  );
}
