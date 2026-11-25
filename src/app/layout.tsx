import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Orçamento CiviObra", template: "%s · Orçamento CiviObra" },
  description: "Sistema de gestão de obras civis para o setor público.",
};

export const viewport: Viewport = { themeColor: "#03161c", width: "device-width", initialScale: 1 };

// Aplica o tema escolhido antes da primeira pintura, para a tela não piscar.
const aplicarTema = `try{var t=localStorage.getItem("civiobra-tema");if(t==="escuro"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.dataset.tema="escuro"}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
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
