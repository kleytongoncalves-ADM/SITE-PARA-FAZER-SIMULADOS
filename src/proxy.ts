import { NextResponse, type NextRequest } from "next/server";

// Primeira barreira: sem cookie de sessão, nem chega às páginas internas.
// A conferência real da sessão acontece no servidor, em cada página e ação.
export function proxy(request: NextRequest) {
  const temCookie = request.cookies.has("civiobra_sessao");
  if (!temCookie && !["/login", "/primeiro-acesso"].includes(request.nextUrl.pathname)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|marca/|icon.png|apple-icon.png|opengraph-image.png|manifest.webmanifest|favicon.ico).*)"],
};
