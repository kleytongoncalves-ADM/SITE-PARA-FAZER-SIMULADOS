import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CiviObras",
    short_name: "CiviObras",
    description: "Sistema de gestão de obras civis para o setor público.",
    start_url: "/inicio",
    display: "standalone",
    background_color: "#03161c",
    theme_color: "#03161c",
    lang: "pt-BR",
    icons: [
      { src: "/marca/icone-192.png", sizes: "192x192", type: "image/png" },
      { src: "/marca/icone-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
