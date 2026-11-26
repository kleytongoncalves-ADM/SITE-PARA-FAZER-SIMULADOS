"use client";

import { useMemo, useState } from "react";
import { FATORES, ROTULO_CRITERIO_APURACAO, ROTULO_FATOR, type Criterio, type Pesos } from "@/servicos/cotacao-calculo";
import { unidade } from "@/lib/unidade";

type Material = { chave: string; codigo: string; descricao: string; unidade: string; quantidade: string; preco: string | null; valor: string; classe: "A" | "B" | "C"; semSinapi: boolean; jaCotado: boolean };

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const qtd = (v: string) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 4 });
const SUGESTAO: Pesos = { preco: 70, prazo: 15, pagamento: 5, garantia: 5, historico: 5 };

export function FormSolicitacao({ materiais, prazoPadrao, prazoMinimo, fonte }: { materiais: Material[]; prazoPadrao: string; prazoMinimo: string; fonte: string }) {
  const [marcadas, setMarcadas] = useState<Set<string>>(() => new Set(materiais.filter((m) => !m.jaCotado).map((m) => m.chave)));
  const [busca, setBusca] = useState("");
  const [criterio, setCriterio] = useState<Criterio>("item");
  const [pesos, setPesos] = useState<Pesos>(SUGESTAO);
  const visiveis = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return b ? materiais.filter((m) => `${m.codigo} ${m.descricao}`.toLowerCase().includes(b)) : materiais;
  }, [busca, materiais]);
  const total = materiais.filter((m) => marcadas.has(m.chave)).reduce((s, m) => s + Number(m.valor), 0);
  const soma = FATORES.reduce((s, k) => s + (Number(pesos[k]) || 0), 0);
  const alternar = (k: string) => setMarcadas((a) => { const n = new Set(a); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const escolher = (f: (m: Material) => boolean) => setMarcadas(new Set(materiais.filter(f).map((m) => m.chave)));

  return (
    <>
      <section className="cartao">
        <h2 className="cartao-titulo">1. Materiais</h2>
        <div className="barra-acoes" style={{ margin: "12px 0" }}>
          <input className="entrada-texto" style={{ maxWidth: 300 }} placeholder="Buscar por código ou descrição" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar material" />
          <div className="chips" style={{ marginLeft: "auto" }}>
            <button type="button" className="chip" onClick={() => escolher(() => true)}>Todos</button>
            <button type="button" className="chip" onClick={() => escolher((m) => m.classe === "A")}>Classe A</button>
            <button type="button" className="chip" onClick={() => escolher((m) => !m.jaCotado)}>Ainda não cotados</button>
            <button type="button" className="chip" onClick={() => escolher(() => false)}>Nenhum</button>
          </div>
        </div>
        <div className="tabela-caixa" style={{ maxHeight: 460, overflowY: "auto" }}>
          <table className="tabela tabela-compacta cot-selecao">
            <thead><tr><th aria-label="Selecionar" /><th>Código</th><th>Material</th><th>Und.</th><th className="dir">Quantidade</th><th className="dir">Preço {fonte}</th><th className="dir">Total de referência</th><th>ABC</th></tr></thead>
            <tbody>{visiveis.map((m) => (
              <tr key={m.chave} className={marcadas.has(m.chave) ? "marcada" : ""} onClick={() => alternar(m.chave)}>
                <td><input type="checkbox" checked={marcadas.has(m.chave)} onChange={() => alternar(m.chave)} onClick={(e) => e.stopPropagation()} aria-label={`Incluir ${m.descricao}`} /></td>
                <td className="num fraco sem-quebra">{m.semSinapi ? "Sem código" : m.codigo}</td>
                <td style={{ minWidth: 240 }}>{m.descricao}{m.jaCotado && <span className="etiqueta et-neutra" style={{ marginLeft: 8 }}>Já em cotação</span>}</td>
                <td>{unidade(m.unidade)}</td>
                <td className="dir num">{qtd(m.quantidade)}</td>
                <td className="dir num">{m.preco ? moeda(Number(m.preco)) : "—"}</td>
                <td className="dir num forte">{moeda(Number(m.valor))}</td>
                <td><span className={`etiqueta ${m.classe === "A" ? "et-vermelha" : m.classe === "B" ? "et-laranja" : "et-neutra"}`}>{m.classe}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        {[...marcadas].map((k) => <input key={k} type="hidden" name="chave" value={k} />)}
        <div className="cot-rodape-selecao" aria-live="polite">
          <span>{marcadas.size} de {materiais.length} {materiais.length === 1 ? "material" : "materiais"}</span>
          <span>Referência <b className="num">{moeda(total)}</b></span>
        </div>
      </section>

      <section className="cartao grade-form">
        <h2 className="cartao-titulo c12">2. Condições</h2>
        <div className="campo c8"><label htmlFor="titulo">Título</label><input id="titulo" name="titulo" className="entrada-texto" required maxLength={160} placeholder="Cimento, areia e blocos" /></div>
        <div className="campo c4"><label htmlFor="prazo">Prazo de resposta</label><input id="prazo" name="prazo" type="datetime-local" className="entrada-texto" required min={prazoMinimo} defaultValue={prazoPadrao} /></div>
        <div className="campo c8"><label htmlFor="localEntrega">Local de entrega</label><input id="localEntrega" name="localEntrega" className="entrada-texto" placeholder="Endereço da obra" /></div>
        <div className="campo c4"><label htmlFor="validadeMinima">Validade mínima da proposta (dias)</label><input id="validadeMinima" name="validadeMinima" className="entrada-texto" inputMode="numeric" placeholder="30" /></div>
        <div className="campo c12"><label htmlFor="observacao">Observações para os fornecedores</label><textarea id="observacao" name="observacao" className="entrada-texto" rows={3} maxLength={2000} /></div>
        <label className="opcao-check c6"><input type="checkbox" name="freteIncluso" defaultChecked /> Preços com frete incluído</label>
        <label className="opcao-check c6"><input type="checkbox" name="sigilo" defaultChecked /> Preços visíveis só depois do prazo</label>
      </section>

      <section className="cartao">
        <h2 className="cartao-titulo">3. Apuração</h2>
        <p className="cartao-sub">Fica travada depois do envio dos convites.</p>
        <div className="chips" role="radiogroup" aria-label="Critério de apuração" style={{ margin: "12px 0" }}>
          {(Object.keys(ROTULO_CRITERIO_APURACAO) as Criterio[]).map((c) => (
            <label key={c} className={`chip ${criterio === c ? "chip-ativo" : ""}`} style={{ cursor: "pointer" }}>
              <input type="radio" name="criterio" value={c} checked={criterio === c} onChange={() => setCriterio(c)} style={{ position: "absolute", opacity: 0, pointerEvents: "none" }} />{ROTULO_CRITERIO_APURACAO[c]}
            </label>
          ))}
        </div>
        {criterio === "custo_beneficio" && (
          <>
            <div className="cot-pesos">
              {FATORES.map((k) => (
                <div className="campo" key={k}><label htmlFor={`peso_${k}`}>{ROTULO_FATOR[k]}</label>
                  <input id={`peso_${k}`} name={`peso_${k}`} className="entrada-texto" inputMode="numeric" value={pesos[k]} onChange={(e) => setPesos({ ...pesos, [k]: Number(e.target.value.replace(/\D/g, "")) || 0 })} /></div>
              ))}
            </div>
            <p className={`cot-soma ${soma !== 100 || pesos.preco < 50 ? "errada" : ""}`} style={{ marginTop: 10 }}>
              Soma dos pesos: {soma} de 100{pesos.preco < 50 ? " · o preço pesa ao menos 50" : ""}
            </p>
            <p className="cartao-sub">Marca não pontua. Fornecedor sem histórico recebe a média dos demais nesse fator.</p>
          </>
        )}
      </section>
    </>
  );
}
