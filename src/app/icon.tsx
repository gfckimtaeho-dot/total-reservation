import { ImageResponse } from "next/og";

export function generateImageMetadata() {
  return [
    {
      id: "192",
      contentType: "image/png",
      size: { width: 192, height: 192 },
    },
    {
      id: "512",
      contentType: "image/png",
      size: { width: 512, height: 512 },
    },
  ];
}

export default async function Icon({
  id,
}: {
  id: Promise<string | number>;
}) {
  const iconId = await id;
  const px = iconId === "512" ? 512 : 192;
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
          fontSize: Math.round(px * 0.62),
          fontWeight: 700,
          letterSpacing: "-0.05em",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        예
      </div>
    ),
    { width: px, height: px },
  );
}
