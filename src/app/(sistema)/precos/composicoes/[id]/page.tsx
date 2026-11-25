import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CopyPlus, Plus, Search, Stamp, Trash2 } from "lucide-react";
import { BotaoEnviar, FormAcao } from "@/componentes/FormAcao";
import { ErroDeRegra } from "@/lib/db";
import { dataHora, mesAno, moeda, valor } from "@/lib/formato";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { pode } from "@/servicos/permissoes";
import {
  buscarComposicoes, buscarInsumos, listarTabelas, obterComposicao, ROTULO_FONTE, ROTULO_REGIME, ROTULO_TIPO_INSUMO,
} from "@/servicos/precos";
import { acaoAprovarComposicao, acaoItemComposicao } from "../../acoes";

export const metadata: Metadata = { title: "Composição" };

export default async function Composicao({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tabela?: string; busca?: string; incluir?: string }> }) {
  const { id } = await params;
  const q = await searchParams;
  const ator = comoAtor(await exigirUsuario());
  const liberadas = (await listarTabelas(ator, { somenteLiberadas: true }));
  const tabelaId = liberadas.find((t) => t.id === q.tabela)?.id ?? liberadas[0]?.id;
  if (!tabelaId) notFound();
  let k;
  try {
    k = await obterComposicao(ator, id, tabelaId);
  } catch (e) {
    if (e instanceof ErroDeRegra) notFound();
    throw e;
  }
  const propria = k.fonte === "propria";
  const editavel = propria && !k.aprovada && pode(ator, "precos.composicao_propria");
  const incluirComp = q.incluir === "composicao";
  const resultados = editavel && q.busca
    ? incluirComp
      ? (await buscarComposicoes(ator, { tabelaId, busca: q.busca, limite: 15 })).filter((x) => x.id !== id).map((x) => ({ id: x.id, codigo: x.codigo, descricao: x.descricao, unidade: x.unidade, preco: x.custo, fonte: x.fonte }))
      : (await buscarInsumos(ator, { tabelaId, busca: q.busca, limite: 15 })).map((x) => ({ id: x.id, codigo: x.codigo, descricao: x.descricao, unidade: x.unidade, preco: x.preco, fonte: x.fonte }))
    : [];
  const base = `/precos/composicoes/${id}?tabela=${tabelaId}`;

  return (
    <>
      <div className="cabecalho">
        <div style={{ minWidth: 0 }}>
          <div className="sobretitulo"><Link href={`/precos?tabela=${tabelaId}`}>Base de preços</Link><span>/</span><span className="num">{ROTULO_FONTE[k.fonte]} {k.codigo}</span></div>
          <h1 className="titulo" style={{ fontSize: 24 }}>{k.descricao}</h1>
          <p className="subtitulo" style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <span>{k.unidade}</span>{k.grupo && <span>· {k.grupo}</span>}
            {propria && (k.aprovada ? <span className="etiqueta et-verde">Aprovada</span> : <span className="etiqueta et-laranja">Aguardando aprovação</span>)}
          </p>
        </div>
        <div className="barra-acoes">
          {pode(ator, "precos.composicao_propria") && (
            <Link href={`/precos/composicoes/nova?origem=${id}&tabela=${tabelaId}`} className="botao botao-neutro"><CopyPlus /> Adaptar como própria</Link>
          )}
          {editavel && pode(ator, "precos.aprovar_composicao") && (
            <FormAcao acao={acaoAprovarComposicao.bind(null, id)} confirmar="Aprovar a composição? Depois de aprovada, ela não pode ser alterada.">
              <BotaoEnviar enviando="Aprovando…"><Stamp /> Aprovar</BotaoEnviar>
            </FormAcao>
          )}
        </div>
      </div>

      <div className="grade">
        <form className="form-linha" action={`/precos/composicoes/${id}`}>
          <select name="tabela" className="entrada-texto" defaultValue={tabelaId} aria-label="Base" style={{ width: 300 }}>
            {liberadas.map((t) => <option key={t.id} value={t.id}>{ROTULO_FONTE[t.fonte]} {t.uf} {mesAno(t.mes)} · {ROTULO_REGIME[t.regime]}</option>)}
          </select>
          <button className="botao botao-neutro">Ver preços</button>
        </form>

        <div className="indicadores">
          <div className="indicador"><span>Material</span><b className="num">{moeda(k.material)}</b></div>
          <div className="indicador"><span>Mão de obra</span><b className="num">{moeda(k.maoDeObra)}</b></div>
          <div className="indicador"><span>Equipamento</span><b className="num">{moeda(k.equipamento)}</b></div>
          <div className="indicador indicador-destaque"><span>Custo unitário</span><b className="num">{k.custo ? moeda(k.custo) : "Sem preço"}</b></div>
        </div>

        <div className="tabela-caixa">
          <table className="tabela tabela-compacta">
            <thead><tr><th>Código</th><th>Descrição</th><th>Tipo</th><th>Und.</th><th className="dir">Coeficiente</th><th className="dir">Preço</th><th className="dir">Parcial</th>{editavel && <th />}</tr></thead>
            <tbody>
              {k.linhas.length === 0 && <tr><td colSpan={8} className="fraco">Sem insumos.</td></tr>}
              {k.linhas.map((l) => (
                <tr key={l.id}>
                  <td className="num fraco">{l.codigo}</td>
                  <td>{l.tipoLinha === "composicao"
                    ? <Link href={`/precos/composicoes/${l.refId}?tabela=${tabelaId}`} className="link-item">{l.descricao}</Link>
                    : <Link href={`/precos/insumos/${l.refId}`} className="link-item">{l.descricao}</Link>}</td>
                  <td className="fraco">{l.tipo ? ROTULO_TIPO_INSUMO[l.tipo] : "Composição"}</td>
                  <td>{l.unidade}</td>
                  <td className="dir num">{valor(l.coeficiente, 4)}</td>
                  <td className="dir num">{l.precoUnitario ? moeda(l.precoUnitario) : <span className="etiqueta et-vermelha">Sem preço</span>}</td>
                  <td className="dir num forte">{l.total ? moeda(l.total) : "—"}</td>
                  {editavel && (
                    <td className="dir">
                      <FormAcao acao={acaoItemComposicao.bind(null, id)} mostrarOk={false}>
                        <input type="hidden" name="itemId" value={l.id} />
                        <BotaoEnviar className="botao botao-texto botao-pequeno" name="acao" value="remover" ariaLabel="Remover" title="Remover"><Trash2 /></BotaoEnviar>
                      </FormAcao>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {editavel && (
          <section className="cartao">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
              <h3 className="cartao-titulo">Incluir na composição</h3>
              <div className="chips">
                <Link href={base} className={`chip ${!incluirComp ? "chip-ativo" : ""}`}>Insumo</Link>
                <Link href={`${base}&incluir=composicao`} className={`chip ${incluirComp ? "chip-ativo" : ""}`}>Composição auxiliar</Link>
              </div>
            </div>
            <form className="form-linha" action={`/precos/composicoes/${id}`}>
              <input type="hidden" name="tabela" value={tabelaId} />
              {incluirComp && <input type="hidden" name="incluir" value="composicao" />}
              <div className="busca-campo"><Search /><input name="busca" type="search" defaultValue={q.busca} placeholder="Código ou descrição" aria-label="Buscar" /></div>
              <button className="botao botao-neutro">Buscar</button>
            </form>
            {q.busca && (resultados.length === 0 ? <p className="cartao-sub" style={{ marginTop: 12 }}>Nada encontrado.</p> : (
              <div className="lista-resultados">
                {resultados.map((r) => (
                  <div key={r.id} className="resultado">
                    <div className="resultado-texto"><span className="fraco num">{ROTULO_FONTE[r.fonte]} {r.codigo} · {r.unidade}</span><span className="forte">{r.descricao}</span></div>
                    <b className="num resultado-preco">{r.preco ? moeda(r.preco) : "—"}</b>
                    <FormAcao acao={acaoItemComposicao.bind(null, id)} className="form-linha" mostrarOk={false}>
                      <input type="hidden" name="tipo" value={incluirComp ? "composicao" : "insumo"} />
                      <input type="hidden" name="refId" value={r.id} />
                      <input name="coeficiente" className="entrada-texto num" inputMode="decimal" placeholder="Coeficiente" aria-label="Coeficiente" required style={{ width: 120, height: 36 }} />
                      <BotaoEnviar className="botao botao-primario botao-pequeno" enviando="…" ariaLabel={`Incluir ${r.codigo}`}><Plus /></BotaoEnviar>
                    </FormAcao>
                  </div>
                ))}
              </div>
            ))}
          </section>
        )}

        {propria && (
          <section className="cartao">
            <h3 className="cartao-titulo" style={{ marginBottom: 10 }}>Justificativa técnica</h3>
            <p style={{ whiteSpace: "pre-wrap" }}>{k.justificativa}</p>
            <p className="cartao-sub" style={{ marginTop: 10 }}>
              Criada por {k.criadoPor ?? "—"}{k.aprovadaEm && <> · aprovada por {k.aprovadaPor} em {dataHora(k.aprovadaEm)}</>}
            </p>
          </section>
        )}

        <Link href={`/precos?tabela=${tabelaId}`} className="botao botao-texto" style={{ justifySelf: "start", paddingLeft: 0 }}><ArrowLeft /> Base de preços</Link>
      </div>
    </>
  );
}
