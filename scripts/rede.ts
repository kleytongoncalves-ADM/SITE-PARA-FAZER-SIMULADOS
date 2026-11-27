/**
 * Download com espera para os robôs de preços. Os sites da Caixa e do DNIT às vezes recusam
 * acessos seguidos (429, 403, 5xx): em vez de desistir, espera e tenta de novo.
 */

/** Respostas que valem nova tentativa: excesso de acessos, bloqueio temporário e falha do servidor. */
export const recusaTemporaria = (status: number) => status === 429 || status === 403 || status >= 500;

/** Espera pedida pelo servidor (Retry-After, em segundos ou data), limitada a 10 minutos. */
export function esperaPedida(cabecalho: string | null, agora = Date.now()): number | null {
  if (!cabecalho) return null;
  const s = Number(cabecalho);
  const ms = Number.isFinite(s) ? s * 1000 : Date.parse(cabecalho) - agora;
  return Number.isFinite(ms) && ms > 0 ? Math.min(ms, 600_000) : null;
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * fetch que tenta de novo nas recusas temporárias e nas falhas de rede.
 * Esperas padrão: 30 s, 2 min e 5 min (ou o que o servidor pedir). Devolve a última resposta.
 */
export async function obterComEspera(
  url: string,
  init: RequestInit & { tempo?: number },
  esperas: number[] = (process.env.ROBO_ESPERAS ?? "30,120,300").split(",").map((s) => Number(s) * 1000),
  log: (m: string) => void = console.log,
): Promise<Response> {
  const { tempo = 180_000, ...resto } = init;
  for (let i = 0; ; i++) {
    let r: Response | null = null;
    let falha: unknown = null;
    try {
      r = await fetch(url, { ...resto, signal: AbortSignal.timeout(tempo) });
    } catch (e) {
      falha = e;
    }
    const tentarDeNovo = falha != null || (r != null && recusaTemporaria(r.status));
    if (!tentarDeNovo || i >= esperas.length) {
      if (falha) throw falha;
      return r!;
    }
    const espera = (r && esperaPedida(r.headers.get("retry-after"))) ?? esperas[i];
    log(`${url}: ${falha ? (falha instanceof Error ? falha.message : String(falha)) : `resposta ${r!.status}`}. Nova tentativa em ${Math.round(espera / 1000)} s.`);
    await r?.body?.cancel().catch(() => {});
    await dormir(espera);
  }
}
