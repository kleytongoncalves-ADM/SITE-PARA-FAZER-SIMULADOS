// CiviObras: diário sem internet.
// Guarda a tela /campo e os arquivos que ela usa, para abrir no canteiro sem
// conexão. Atua só nessa tela (escopo /campo); o resto do sistema não passa
// por aqui. Os lançamentos ficam no IndexedDB do aparelho, não neste cache.
const TELA = "campo-tela-v1";
const ARQUIVOS = "campo-arquivos-v1";
const CAMINHO = "/campo";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== TELA && k !== ARQUIVOS) await caches.delete(k);
    await self.clients.claim();
  })());
});

const ESTATICO = (p) => p.startsWith("/_next/static/") || p.startsWith("/marca/") || p === "/icon.png" || p === "/favicon.ico";

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate" && url.pathname === CAMINHO) {
    e.respondWith((async () => {
      try {
        const r = await fetch(req);
        if (r.ok && !r.redirected && new URL(r.url).pathname === CAMINHO) await (await caches.open(TELA)).put(CAMINHO, r.clone());
        return r;
      } catch {
        const guardada = await caches.match(CAMINHO, { cacheName: TELA });
        return guardada ?? new Response(
          "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width'><title>Sem conexão</title>" +
          "<body style='font-family:system-ui;padding:32px;background:#03161c;color:#e8f3f5'><h1 style='font-size:20px'>Sem conexão</h1>" +
          "<p>Abra o Diário em campo uma vez com internet para usar sem conexão.</p>",
          { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
      }
    })());
    return;
  }

  if (ESTATICO(url.pathname)) {
    e.respondWith((async () => {
      const guardado = await caches.match(req, { cacheName: ARQUIVOS });
      if (guardado) return guardado;
      const r = await fetch(req);
      if (r.ok) (await caches.open(ARQUIVOS)).put(req, r.clone());
      return r;
    })());
  }
});

// A tela informa os arquivos que usou. Eles são guardados, e os de versões anteriores saem.
self.addEventListener("message", (e) => {
  const d = e.data;
  if (!d || d.tipo !== "guardar-arquivos" || !Array.isArray(d.urls)) return;
  e.waitUntil((async () => {
    const cache = await caches.open(ARQUIVOS);
    const urls = d.urls.map((u) => new URL(u, self.location.origin)).filter((u) => u.origin === self.location.origin && ESTATICO(u.pathname)).map((u) => u.href);
    for (const u of urls) {
      if (await cache.match(u)) continue;
      try { const r = await fetch(u); if (r.ok) await cache.put(u, r); } catch { /* sem conexão: fica para a próxima */ }
    }
    const manter = new Set(urls);
    for (const req of await cache.keys()) if (!manter.has(req.url)) await cache.delete(req);
  })());
});
