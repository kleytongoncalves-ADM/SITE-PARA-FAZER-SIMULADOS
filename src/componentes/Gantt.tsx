import { dataCurta } from "@/lib/formato";
import { diasEntre, type Periodo } from "@/servicos/cpm";
import type { Atividade } from "@/servicos/cronogramas";

type Props = {
  atividades: Atividade[];
  inicio: string;
  termino: string;
  periodos: Periodo[];
  hoje: string;
  fimContrato: string | null;
  mostrarAvanco: boolean;
};

/** Cronograma em barras: posição e largura proporcionais aos dias do período mostrado. */
export function Gantt({ atividades, inicio, termino, periodos, hoje, fimContrato, mostrarAvanco }: Props) {
  const fimEscala = [termino, periodos.at(-1)?.fim ?? termino, fimContrato ?? termino].sort().at(-1)!;
  const total = diasEntre(inicio, fimEscala) + 1;
  const pos = (iso: string) => `${(Math.max(0, diasEntre(inicio, iso)) / total) * 100}%`;
  const larg = (de: string, ate: string) => `${((diasEntre(de, ate) + 1) / total) * 100}%`;
  const hojeVisivel = hoje >= inicio && hoje <= fimEscala;
  const fimVisivel = fimContrato && fimContrato >= inicio;

  return (
    <div className="gantt-caixa">
      <table className="gantt">
        <colgroup>
          <col style={{ width: 60 }} /><col style={{ width: 240 }} /><col style={{ width: 48 }} /><col style={{ width: 96 }} /><col style={{ width: 96 }} /><col style={{ width: 52 }} /><col />
        </colgroup>
        <thead>
          <tr>
            <th>Código</th><th>Atividade</th><th className="dir">Dias</th><th>Início</th><th>Fim</th><th className="dir">Folga</th>
            <th className="gantt-escala">
              <div className="gantt-periodos">
                {periodos.map((p) => (
                  <span key={p.indice} style={{ left: pos(p.inicio), width: larg(p.inicio, p.fim > fimEscala ? fimEscala : p.fim) }}>{p.rotulo}</span>
                ))}
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {atividades.map((a) => {
            const marco = a.duracao === 0;
            const cls = `gantt-barra ${a.critica ? "gantt-critica" : ""} ${a.atrasada ? "gantt-atrasada" : ""}`;
            return (
              <tr key={a.id}>
                <td className="num">{a.codigo}</td>
                <td><span className="gantt-nome" title={a.nome}>{a.nome}</span></td>
                <td className="dir num">{a.duracao}</td>
                <td className="num">{dataCurta(a.inicio)}</td>
                <td className="num">{dataCurta(a.fim)}</td>
                <td className="dir num">{a.folga ?? "—"}</td>
                <td className="gantt-trilho">
                  {periodos.map((p) => <i key={p.indice} className="gantt-grade" style={{ left: pos(p.inicio) }} />)}
                  {hojeVisivel && <i className="gantt-hoje" style={{ left: pos(hoje) }} />}
                  {fimVisivel && <i className="gantt-limite" style={{ left: `calc(${pos(fimContrato!)} + ${100 / total}%)` }} />}
                  {a.inicio && a.fim && (marco ? (
                    <span className={`gantt-marco ${a.critica ? "gantt-critica" : ""}`} style={{ left: pos(a.inicio) }} title={`${a.codigo} ${a.nome}: ${dataCurta(a.inicio)}`} />
                  ) : (
                    <span className={cls} style={{ left: pos(a.inicio), width: larg(a.inicio, a.fim) }}
                      title={`${a.codigo} ${a.nome}: ${dataCurta(a.inicio)} a ${dataCurta(a.fim)}${a.critica ? " · crítica" : ` · folga de ${a.folga} dia(s)`}${mostrarAvanco ? ` · ${a.avancoAtual.toLocaleString("pt-BR")}% executado` : ""}`}>
                      {mostrarAvanco && a.avancoAtual > 0 && <b style={{ width: `${a.avancoAtual}%` }} />}
                    </span>
                  ))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="gantt-legenda">
        <span><i className="gantt-barra" /> Atividade</span>
        <span><i className="gantt-barra gantt-critica" /> Caminho crítico</span>
        <span><i className="gantt-marco" /> Marco</span>
        {mostrarAvanco && <span><i className="gantt-barra gantt-legenda-avanco"><b style={{ width: "60%" }} /></i> Executado</span>}
        {hojeVisivel && <span><i className="gantt-hoje-legenda" /> Hoje</span>}
        {fimVisivel && <span><i className="gantt-limite-legenda" /> Fim do prazo contratual</span>}
      </div>
    </div>
  );
}
