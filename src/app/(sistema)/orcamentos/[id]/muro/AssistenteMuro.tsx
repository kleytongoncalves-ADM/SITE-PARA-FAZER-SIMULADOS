"use client";

import { useActionState, useState } from "react";
import { Calculator, Check } from "lucide-react";
import { Avisos } from "@/componentes/Avisos";
import { moeda, quantidade } from "@/lib/formato";
import type { LinhaMuro, ParametrosMuro } from "@/servicos/assistente-muro";
import { acaoLancarMuro, acaoSugerirMuro, type Estado } from "../../acoes";

const CAMPOS: [keyof ParametrosMuro, string][] = [
  ["comprimento", "Comprimento (m)"], ["altura", "Altura (m)"], ["vaoPilaretes", "Vão entre pilaretes (m)"],
  ["larguraSapata", "Largura da sapata (m)"], ["alturaSapata", "Altura da sapata (m)"],
  ["larguraVala", "Largura da vala (m)"], ["profundidadeVala", "Profundidade da vala (m)"],
];

const num = (v: string) => Number(String(v).replace(",", ".")) || 0;

/** Vista do muro em elevação: blocos, pilaretes e cinta, na proporção informada. */
function VistaMuro({ p }: { p: ParametrosMuro }) {
  const L = Math.min(Math.max(num(p.comprimento), 1), 60), H = Math.min(Math.max(num(p.altura), 0.5), 6), vao = Math.max(num(p.vaoPilaretes), 0.5);
  const escala = 560 / Math.max(L, H * 3);
  const w = L * escala, h = H * escala, base = num(p.alturaSapata) * escala || 8;
  const n = Math.ceil(L / vao);
  const pilaretes = Array.from({ length: n + 1 }, (_, i) => Math.min(i * vao, L - 0.15));
  const bloco = 0.2 * escala;
  const fiadas = Math.floor((H - 0.15) / 0.2);
  return (
    <svg viewBox={`-10 -10 ${w + 20} ${h + base + 30}`} className="vista-muro" role="img" aria-label={`Muro de ${p.comprimento} m por ${p.altura} m com ${n + 1} pilaretes`}>
      <defs>
        <pattern id="blocos" width={bloco} height={bloco} patternUnits="userSpaceOnUse">
          <rect width={bloco} height={bloco} fill="#c8643b" />
          <path d={`M0 ${bloco - 1} H${bloco} M${bloco - 1} 0 V${bloco}`} stroke="#e8d6c4" strokeWidth="1.5" />
        </pattern>
      </defs>
      <rect x={-6} y={h} width={w + 12} height={base} fill="#9aa5a8" rx="2" />
      <rect x={0} y={0} width={w} height={h} fill="url(#blocos)" />
      {pilaretes.map((x, i) => <rect key={i} x={x * escala} y={0} width={0.15 * escala} height={h} fill="#b9c2c4" stroke="#8c979a" />)}
      <rect x={0} y={0} width={w} height={0.15 * escala} fill="#b9c2c4" stroke="#8c979a" />
      <text x={w / 2} y={h + base + 18} textAnchor="middle" fontSize="12" fill="currentColor">{p.comprimento} m · {fiadas} fiadas · {n + 1} pilaretes</text>
    </svg>
  );
}

export function AssistenteMuro({ id, padrao }: { id: string; padrao: ParametrosMuro }) {
  const [p, setP] = useState<ParametrosMuro>(padrao);
  const [sug, calcular, calculando] = useActionState<Estado, FormData>(acaoSugerirMuro.bind(null, id), {});
  const [lanc, lancar, lancando] = useActionState<Estado, FormData>(acaoLancarMuro.bind(null, id), {});
  const linhas = (sug.dados as { linhas: LinhaMuro[] } | undefined)?.linhas;
  const [escolha, setEscolha] = useState<Record<string, string>>({});

  return (
    <>
      <div className="grade duas-colunas" style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.2fr)", alignItems: "start" }}>
        <form action={calcular} className="cartao surgir" style={{ display: "grid", gap: 14 }}>
          <Avisos erro={sug.erro} />
          <div className="grade-form">
            {CAMPOS.map(([k, rotulo]) => (
              <div key={k} className="campo c6">
                <label htmlFor={k}>{rotulo}</label>
                <input id={k} name={k} className="entrada-texto num" inputMode="decimal" value={p[k]} onChange={(e) => setP({ ...p, [k]: e.target.value })} required />
              </div>
            ))}
            <div className="campo c6">
              <label htmlFor="faces">Revestimento</label>
              <select id="faces" name="faces" className="entrada-texto" value={p.faces} onChange={(e) => setP({ ...p, faces: e.target.value as "1" | "2" })}>
                <option value="2">Duas faces</option><option value="1">Uma face</option>
              </select>
            </div>
          </div>
          <button className="botao botao-primario" disabled={calculando} style={{ justifySelf: "start" }}><Calculator />{calculando ? "Calculando…" : "Calcular quantidades"}</button>
        </form>
        <div className="cartao surgir" style={{ "--i": 1, display: "grid", placeItems: "center", minHeight: 260 } as React.CSSProperties}>
          <VistaMuro p={p} />
        </div>
      </div>

      {linhas && (
        <form action={lancar} className="tabela-caixa surgir">
          <div className="etapa-cabecalho"><h3 className="etapa-nome">Serviços do muro</h3></div>
          <Avisos erro={lanc.erro} />
          <table className="tabela tabela-compacta">
            <thead><tr><th>Usar</th><th>Serviço</th><th>Composição</th><th className="dir">Quant.</th><th className="dir">Custo unit.</th><th>Memória</th></tr></thead>
            <tbody>
              {linhas.map((l) => {
                const atual = escolha[l.chave] ?? l.escolhida ?? "";
                const k = l.opcoes.find((o) => o.id === atual);
                return (
                  <tr key={l.chave}>
                    <td>
                      <input type="hidden" name="chave" value={l.chave} />
                      <input type="checkbox" name={`usar_${l.chave}`} defaultChecked={!!l.escolhida} disabled={!l.opcoes.length} aria-label={`Usar ${l.nome}`} />
                    </td>
                    <td className="forte">{l.nome}</td>
                    <td style={{ minWidth: 260 }}>
                      {l.opcoes.length ? (
                        <select name={`comp_${l.chave}`} className="entrada-texto" value={atual} onChange={(e) => setEscolha({ ...escolha, [l.chave]: e.target.value })} style={{ height: 36, fontSize: 12.5 }}>
                          {l.opcoes.map((o) => <option key={o.id} value={o.id}>{o.codigo} · {o.descricao}</option>)}
                        </select>
                      ) : <span className="etiqueta et-vermelha">Sem composição na base</span>}
                    </td>
                    <td className="dir">
                      <input name={`qtd_${l.chave}`} className="entrada-texto num" defaultValue={quantidade(l.quantidade)} inputMode="decimal" style={{ width: 96, height: 36, textAlign: "right" }} aria-label={`Quantidade de ${l.nome}`} />
                      <span className="fraco"> {l.unidade}</span>
                    </td>
                    <td className="dir num">{k?.custo ? moeda(k.custo) : "—"}</td>
                    <td className="fraco">
                      <input type="hidden" name={`mem_${l.chave}`} value={l.memoria} />{l.memoria}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="rodape-form">
            <div className="campo" style={{ width: 240 }}>
              <label htmlFor="nomeEtapa">Etapa</label>
              <input id="nomeEtapa" name="nomeEtapa" className="entrada-texto" defaultValue="Muro" required />
            </div>
            <fieldset className="opcoes">
              <legend>Lançar</legend>
              <label><input type="radio" name="modo" value="servico" defaultChecked /> Por serviço</label>
              <label><input type="radio" name="modo" value="material" /> Por material e mão de obra</label>
            </fieldset>
            <button className="botao botao-primario" disabled={lancando}><Check />{lancando ? "Lançando…" : "Lançar no orçamento"}</button>
          </div>
        </form>
      )}
    </>
  );
}
