/**
 * Gráficos do relatório em SVG, desenhados no servidor: saem iguais na tela e na impressão.
 */
import { moeda, percentual } from "@/lib/formato";

export const COR = { material: "#19b6c2", maoDeObra: "#f28c28", equipamento: "#5b54c9", bdi: "#2b6777", linha: "#e06f0c" } as const;

type Fatia = { rotulo: string; valor: number; cor: string };

/** Barra única empilhada com legenda: composição de um total. */
export function BarraComposicao({ fatias, titulo }: { fatias: Fatia[]; titulo: string }) {
  const total = fatias.reduce((s, f) => s + f.valor, 0) || 1;
  return (
    <figure className="rel-grafico">
      <figcaption className="rel-grafico-titulo">{titulo}</figcaption>
      <div className="rel-empilhada" role="img" aria-label={fatias.map((f) => `${f.rotulo} ${percentual((f.valor / total) * 100, 1)}`).join(", ")}>
        {fatias.filter((f) => f.valor > 0).map((f) => (
          <span key={f.rotulo} style={{ width: `${(f.valor / total) * 100}%`, background: f.cor }}>
            {f.valor / total >= 0.08 ? percentual((f.valor / total) * 100, 1) : ""}
          </span>
        ))}
      </div>
      <ul className="rel-legenda">
        {fatias.map((f) => (
          <li key={f.rotulo}><i style={{ background: f.cor }} /><span>{f.rotulo}</span><b className="num">{moeda(f.valor)}</b><small className="num">{percentual((f.valor / total) * 100, 1)}</small></li>
        ))}
      </ul>
    </figure>
  );
}

/** Pareto da curva ABC: barras por item em ordem decrescente e linha do acumulado, com as faixas de 80% e 95%. */
export function Pareto({ itens, titulo }: { itens: { rotulo: string; valor: number; acumulado: number; classe: "A" | "B" | "C" }[]; titulo: string }) {
  const max = 24;
  const lista = itens.length > max
    ? [...itens.slice(0, max - 1), { rotulo: "Demais", valor: itens.slice(max - 1).reduce((s, i) => s + i.valor, 0), acumulado: 100, classe: "C" as const }]
    : itens;
  const W = 720, H = 250, e = 44, d = 40, t = 16, b = 34;
  const larg = (W - e - d) / Math.max(1, lista.length);
  const maior = Math.max(1, ...lista.map((i) => i.valor));
  const y = (v: number) => t + (H - t - b) * (1 - v / maior);
  const yp = (p: number) => t + (H - t - b) * (1 - p / 100);
  const corClasse = { A: "#0e3a47", B: "#19b6c2", C: "#9bb8bf" };
  const pontos = lista.map((i, k) => `${e + larg * k + larg / 2},${yp(i.acumulado)}`).join(" ");
  return (
    <figure className="rel-grafico">
      <figcaption className="rel-grafico-titulo">{titulo}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="rel-svg" role="img" aria-label={titulo}>
        {[80, 95].map((p) => (
          <g key={p}>
            <line x1={e} x2={W - d} y1={yp(p)} y2={yp(p)} stroke="currentColor" strokeOpacity="0.35" strokeDasharray="4 4" />
            <text x={W - d + 4} y={yp(p) + 4} fontSize="11" fill="currentColor" fillOpacity="0.7">{p}%</text>
          </g>
        ))}
        <line x1={e} x2={W - d} y1={H - b} y2={H - b} stroke="currentColor" strokeOpacity="0.3" />
        <text x={e - 6} y={t + 4} fontSize="10" textAnchor="end" fill="currentColor" fillOpacity="0.7">{moeda(maior).replace(",00", "")}</text>
        <text x={e - 6} y={H - b} fontSize="10" textAnchor="end" fill="currentColor" fillOpacity="0.7">0</text>
        {lista.map((i, k) => (
          <g key={k}>
            <rect x={e + larg * k + larg * 0.14} y={y(i.valor)} width={larg * 0.72} height={H - b - y(i.valor)} rx="3" fill={corClasse[i.classe]}>
              <title>{`${i.rotulo}: ${moeda(i.valor)} · acumulado ${percentual(i.acumulado)}`}</title>
            </rect>
            {lista.length <= 16 && <text x={e + larg * k + larg / 2} y={H - b + 14} fontSize="10" textAnchor="middle" fill="currentColor" fillOpacity="0.75">{i.rotulo}</text>}
          </g>
        ))}
        <polyline points={pontos} fill="none" stroke={COR.linha} strokeWidth="2.2" />
        {lista.map((i, k) => <circle key={k} cx={e + larg * k + larg / 2} cy={yp(i.acumulado)} r="3" fill={COR.linha} />)}
      </svg>
      <ul className="rel-legenda rel-legenda-linha">
        <li><i style={{ background: corClasse.A }} /><span>Classe A</span></li>
        <li><i style={{ background: corClasse.B }} /><span>Classe B</span></li>
        <li><i style={{ background: corClasse.C }} /><span>Classe C</span></li>
        <li><i style={{ background: COR.linha, height: 3 }} /><span>Acumulado (%)</span></li>
      </ul>
    </figure>
  );
}

/** Desembolso por período (barras) e acumulado em % (curva S). */
export function CurvaS({ periodos, titulo }: { periodos: { rotulo: string; valor: number; acumulado: number }[]; titulo: string }) {
  const W = 720, H = 240, e = 44, d = 40, t = 16, b = 34;
  const larg = (W - e - d) / Math.max(1, periodos.length);
  const maior = Math.max(1, ...periodos.map((p) => p.valor));
  const y = (v: number) => t + (H - t - b) * (1 - v / maior);
  const yp = (p: number) => t + (H - t - b) * (1 - p / 100);
  const pontos = [`${e},${H - b}`, ...periodos.map((p, k) => `${e + larg * (k + 1)},${yp(p.acumulado)}`)].join(" ");
  return (
    <figure className="rel-grafico">
      <figcaption className="rel-grafico-titulo">{titulo}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="rel-svg" role="img" aria-label={titulo}>
        {[25, 50, 75, 100].map((p) => (
          <g key={p}>
            <line x1={e} x2={W - d} y1={yp(p)} y2={yp(p)} stroke="currentColor" strokeOpacity="0.12" />
            <text x={W - d + 4} y={yp(p) + 4} fontSize="10" fill="currentColor" fillOpacity="0.7">{p}%</text>
          </g>
        ))}
        <line x1={e} x2={W - d} y1={H - b} y2={H - b} stroke="currentColor" strokeOpacity="0.3" />
        <text x={e - 6} y={t + 4} fontSize="10" textAnchor="end" fill="currentColor" fillOpacity="0.7">{moeda(maior).replace(",00", "")}</text>
        {periodos.map((p, k) => (
          <g key={k}>
            <rect x={e + larg * k + larg * 0.18} y={y(p.valor)} width={larg * 0.64} height={H - b - y(p.valor)} rx="3" fill={COR.material}>
              <title>{`${p.rotulo}: ${moeda(p.valor)} · acumulado ${percentual(p.acumulado)}`}</title>
            </rect>
            {periodos.length <= 24 && <text x={e + larg * k + larg / 2} y={H - b + 14} fontSize="10" textAnchor="middle" fill="currentColor" fillOpacity="0.75">{p.rotulo}</text>}
          </g>
        ))}
        <polyline points={pontos} fill="none" stroke={COR.linha} strokeWidth="2.2" />
      </svg>
      <ul className="rel-legenda rel-legenda-linha">
        <li><i style={{ background: COR.material }} /><span>Desembolso no período (R$)</span></li>
        <li><i style={{ background: COR.linha, height: 3 }} /><span>Acumulado (%)</span></li>
      </ul>
    </figure>
  );
}

/** Barra fina de participação, para colunas de tabela. */
export function Participacao({ pct, cor = COR.material }: { pct: number; cor?: string }) {
  return (
    <span className="rel-part"><i style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: cor }} /><b className="num">{percentual(pct, 1)}</b></span>
  );
}
