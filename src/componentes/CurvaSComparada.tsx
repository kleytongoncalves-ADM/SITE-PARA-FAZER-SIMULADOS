import { moedaCurta } from "@/lib/formato";

type Ponto = { rotulo: string; previsto: number; previstoPct: number; realizadoPct: number | null };

/** Curva S prevista (linha de base) e realizada, em percentual acumulado, com o desembolso previsto por período em barras. */
export function CurvaSComparada({ pontos, titulo }: { pontos: Ponto[]; titulo: string }) {
  const W = 760, H = 260, e = 64, d = 44, t = 16, b = 34;
  const lw = W - e - d, lh = H - t - b;
  const n = Math.max(1, pontos.length);
  const passo = lw / n;
  const x = (i: number) => e + passo * i + passo / 2;
  const yPct = (p: number) => t + lh - (Math.max(0, Math.min(100, p)) / 100) * lh;
  const maxBarra = Math.max(1, ...pontos.map((p) => p.previsto));
  const yVal = (v: number) => t + lh - (v / maxBarra) * lh;
  const linha = (vals: (number | null)[]) =>
    vals.map((v, i) => (v == null ? null : `${x(i)},${yPct(v)}`)).filter(Boolean).join(" ");
  const real = pontos.map((p) => p.realizadoPct);
  const temReal = real.some((v) => v != null);
  const rotular = n <= 16 ? 1 : Math.ceil(n / 16);

  return (
    <figure className="curva-s">
      <figcaption>{titulo}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={titulo}>
        {[0, 25, 50, 75, 100].map((p) => (
          <g key={p}>
            <line x1={e} x2={W - d} y1={yPct(p)} y2={yPct(p)} className="curva-s-grade" />
            <text x={W - d + 6} y={yPct(p) + 4} className="curva-s-eixo">{p}%</text>
          </g>
        ))}
        <text x={e - 8} y={t + 4} textAnchor="end" className="curva-s-eixo">{moedaCurta(maxBarra)}</text>
        <text x={e - 8} y={t + lh + 4} textAnchor="end" className="curva-s-eixo">R$ 0</text>
        {pontos.map((p, i) => (
          <rect key={i} x={x(i) - Math.min(28, passo * 0.32)} width={Math.min(56, passo * 0.64)} y={yVal(p.previsto)} height={Math.max(0, t + lh - yVal(p.previsto))} className="curva-s-barra" rx={3}>
            <title>{`${p.rotulo}: ${moedaCurta(p.previsto)} previsto no período`}</title>
          </rect>
        ))}
        <polyline points={linha(pontos.map((p) => p.previstoPct))} className="curva-s-prevista" />
        {temReal && <polyline points={linha(real)} className="curva-s-realizada" />}
        {pontos.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={yPct(p.previstoPct)} r={3.2} className="curva-s-ponto-prev"><title>{`${p.rotulo}: ${p.previstoPct.toFixed(1).replace(".", ",")}% previsto`}</title></circle>
            {p.realizadoPct != null && <circle cx={x(i)} cy={yPct(p.realizadoPct)} r={3.6} className="curva-s-ponto-real"><title>{`${p.rotulo}: ${p.realizadoPct.toFixed(1).replace(".", ",")}% realizado`}</title></circle>}
            {i % rotular === 0 && <text x={x(i)} y={H - 12} textAnchor="middle" className="curva-s-eixo">{p.rotulo}</text>}
          </g>
        ))}
      </svg>
      <div className="gantt-legenda">
        <span><i className="curva-s-leg-barra" /> Desembolso previsto no período (R$)</span>
        <span><i className="curva-s-leg-prev" /> Previsto acumulado (%)</span>
        {temReal && <span><i className="curva-s-leg-real" /> Realizado acumulado (%)</span>}
      </div>
    </figure>
  );
}
