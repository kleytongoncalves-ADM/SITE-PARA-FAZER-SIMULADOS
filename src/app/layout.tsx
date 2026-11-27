import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./revisao-visual.css";

export const metadata: Metadata = {
  // No Netlify, URL é o endereço público do site. Serve para a imagem de compartilhamento de link.
  metadataBase: new URL(process.env.URL ?? "http://localhost:3000"),
  title: { default: "CiviObras", template: "%s · CiviObras" },
  description: "Sistema de gestão de obras civis para o setor público.",
  applicationName: "CiviObras",
  openGraph: { title: "CiviObras", description: "Gestão de obras civis para o setor público.", siteName: "CiviObras", locale: "pt_BR", type: "website" },
  twitter: { card: "summary_large_image", title: "CiviObras", description: "Gestão de obras civis para o setor público." },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#03161c", width: "device-width", initialScale: 1 };

// Aplica o tema escolhido antes da primeira pintura, para a tela não piscar.
const aplicarTema = `try{var t=localStorage.getItem("civiobra-tema");if(t==="escuro"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.dataset.tema="escuro"}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: aplicarTema }} />
      </head>
      <body>
        <div className="fundo" aria-hidden="true">
          <span className="bolha bolha-1" />
          <span className="bolha bolha-2" />
          <span className="bolha bolha-3" />
        </div>
        {children}
      </body>
    </html>
  );
}
