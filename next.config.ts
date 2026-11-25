import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sistema interno e autenticado: todas as páginas são renderizadas a cada requisição.
  serverExternalPackages: ["pg"],
  poweredByHeader: false,
  // Documentos da obra chegam por formulário, com arquivos de até 4 MB.
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
  // A logo entra nas planilhas exportadas: o arquivo precisa ir junto com as rotas de exportação.
  outputFileTracingIncludes: { "/**/excel": ["./public/marca/logo.png"] },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
