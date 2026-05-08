import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "예약가즈아",
    short_name: "예약가즈아",
    description: "헬스장 운영 관리 SaaS",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      {
        src: "/icon/192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
