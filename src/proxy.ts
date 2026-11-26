import { NextResponse, type NextRequest } from "next/server";

const PUBLICAS = ["/login", "/plataforma/entrar"];

// Primeira barreira: sem cookie de sessão, nem chega às páginas internas.
// A conferência real da sessão acontece no servidor, em cada página e ação.
// A área da plataforma (/plataforma) tem sessão própria, separada da do sistema.
export function proxy(request: NextRequest) {
  const caminho = request.nextUrl.pathname;
  if (PUBLICAS.includes(caminho)) return NextResponse.next();
  // Página do fornecedor: aberta só pelo link individual do convite, conferido no servidor.
  if (caminho.startsWith("/cotacao/")) return NextResponse.next();
  const daPlataforma = caminho === "/plataforma" || caminho.startsWith("/plataforma/");
  if (daPlataforma) {
    if (!request.cookies.has("civiobra_plataforma")) return NextResponse.redirect(new URL("/plataforma/entrar", request.url));
    return NextResponse.next();
  }
  if (!request.cookies.has("civiobra_sessao")) return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|marca/|icon.png|apple-icon.png|opengraph-image.png|manifest.webmanifest|favicon.ico).*)"],
};
