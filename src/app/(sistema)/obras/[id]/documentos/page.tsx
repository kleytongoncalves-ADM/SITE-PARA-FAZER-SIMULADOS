import type { Metadata } from "next";
import Link from "next/link";
import { Download, FileSpreadsheet, FileText, Upload } from "lucide-react";
import { BotaoEnviar, FormAcao } from "@/componentes/FormAcao";
import { dataCurta } from "@/lib/formato";
import { CATEGORIAS, documentosDaObra, EXTENSOES_ACEITAS, ROTULO_CATEGORIA } from "@/servicos/documentos";
import { pode } from "@/servicos/permissoes";
import { acaoDispensar, acaoEnviarDocumento } from "../../../documentos/acoes";
import { EtiquetaDocumento, opcoesDocumento, tamanhoArquivo } from "../../../documentos/Apoio";
import { CamposDocumento } from "../../../documentos/CamposDocumento";
import { CabecalhoObra } from "../CabecalhoObra";
import { carregarObra } from "../carregar";

export const metadata: Metadata = { title: "Documentos da obra" };

export default async function DocumentosDaObra({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ antigos?: string }> }) {
  const { id } = await params;
  const { antigos } = await searchParams;
  const { ator, obra } = await carregarObra(id);
  const cab = <CabecalhoObra obra={obra} aba="documentos" podeEditar={pode(ator, "obra.editar")} />;
  if (!pode(ator, "documentos.ver")) return <>{cab}<div className="cartao vazio"><b>Seu perfil não acessa os documentos</b></div></>;
  const p = await documentosDaObra(ator, id);
  const verAntigos = antigos === "1";
  const visiveis = p.documentos.filter((d) => verAntigos || d.situacao !== "superado");
  const superados = p.documentos.length - p.documentos.filter((d) => d.situacao !== "superado").length;
  const atendidas = p.exigencias.filter((e) => e.atendida).length;
  const grupos = [...new Set(p.gerados.map((g) => g.grupo))];

  return (
    <>
      {cab}
      <div className="indicadores">
        <div className="indicador"><span>Documentos vigentes</span><b className="num">{p.documentos.filter((d) => d.situacao === "vigente" || d.situacao === "vencendo").length}</b><small>{superados ? `${superados} ${superados === 1 ? "superado" : "superados"} no histórico` : "sem documentos superados"}</small></div>
        <div className={`indicador${p.vencidos ? " indicador-destaque" : ""}`}><span>Vencidos</span><b className="num">{p.vencidos}</b><small>{p.vencendo} {p.vencendo === 1 ? "vence" : "vencem"} em até 30 dias</small></div>
        <div className={`indicador${p.pendentes ? " indicador-destaque" : ""}`}><span>Exigências atendidas</span><b className="num">{atendidas} de {p.exigencias.length}</b><small>{p.ativa ? (p.pendentes ? `${p.pendentes} ${p.pendentes === 1 ? "pendente" : "pendentes"}` : "todas atendidas") : "cobradas a partir do início da execução"}</small></div>
        <div className="indicador"><span>Gerados pelo sistema</span><b className="num">{p.gerados.length}</b><small>notas, boletins, termos e relatórios</small></div>
      </div>

      <div className="barra-acoes" style={{ margin: "6px 0 12px" }}>
        <h2 className="cartao-titulo">Exigências da obra</h2>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href={`/obras/${id}/documentos/relatorio`} className="botao botao-neutro botao-pequeno"><FileText /> Relatório</Link>
          <a href={`/obras/${id}/documentos/excel`} className="botao botao-neutro botao-pequeno"><FileSpreadsheet /> Excel</a>
        </div>
      </div>
      <div className="grade">
        <div className="tabela-caixa">
          <table className="tabela tabela-compacta">
            <thead><tr><th>Exigência</th><th>Atendida por</th><th>Situação</th>{p.podeDispensar && <th>Dispensa</th>}</tr></thead>
            <tbody>{p.exigencias.map((e) => (
              <tr key={e.chave} className={!e.atendida && p.ativa ? "linha-vencida" : ""}>
                <td className="forte">{e.rotulo}</td>
                <td>{e.documento ? <Link href={`/documentos/${e.documento.id}`}>{e.documento.titulo}</Link>
                  : e.dispensa ? <span className="fraco">Dispensada: {e.dispensa.justificativa}{e.dispensa.por ? ` (${e.dispensa.por})` : ""}</span> : <span className="fraco">—</span>}</td>
                <td>{e.documento ? <EtiquetaDocumento situacao={e.documento.situacao} /> : e.dispensa ? <span className="etiqueta et-neutra">Dispensada</span>
                  : <span className={`etiqueta ${p.ativa ? "et-vermelha" : "et-laranja"}`}>Pendente</span>}</td>
                {p.podeDispensar && <td>{!e.atendida && !e.documento && (
                  <details>
                    <summary className="fraco" style={{ cursor: "pointer" }}>Dispensar</summary>
                    <FormAcao acao={acaoDispensar.bind(null, id)} className="form-minimo" style={{ marginTop: 6 }} mostrarOk={false} confirmar={`Dispensar ${e.rotulo.toLowerCase()}? A dispensa não se desfaz.`}>
                      <input type="hidden" name="exigencia" value={e.chave} />
                      <input name="justificativa" className="entrada-texto" placeholder="Justificativa" aria-label={`Justificativa da dispensa de ${e.rotulo}`} minLength={10} required />
                      <BotaoEnviar className="botao botao-neutro botao-pequeno">Registrar</BotaoEnviar>
                    </FormAcao>
                  </details>)}</td>}
              </tr>
            ))}</tbody>
          </table>
        </div>

        {p.podeEnviar && (
          <details className="detalhe-acao" open={p.documentos.length === 0 || undefined}>
            <summary>Enviar documento</summary>
            <FormAcao acao={acaoEnviarDocumento.bind(null, id)} className="grade-form" style={{ marginTop: 10 }}>
              <CamposDocumento prefixo="novo" opcoes={opcoesDocumento(p.contratos, p.obra.formaExecucao)} />
              <div className="campo c12"><label htmlFor="novo-arq">Arquivo</label>
                <input id="novo-arq" name="arquivo" type="file" accept={EXTENSOES_ACEITAS} className="entrada-texto" required />
                <small className="fraco">PDF, imagem, DWG, DXF, IFC, planilha, texto ou ZIP, até 4 MB.</small></div>
              <div className="c12 rodape-form"><BotaoEnviar enviando="Enviando…"><Upload /> Enviar</BotaoEnviar></div>
            </FormAcao>
          </details>
        )}

        <section className="cartao">
          <div className="barra-acoes">
            <h2 className="cartao-titulo">Documentos enviados</h2>
            {superados > 0 && <Link href={verAntigos ? `/obras/${id}/documentos` : `/obras/${id}/documentos?antigos=1`} className="botao botao-neutro botao-pequeno" style={{ marginLeft: "auto" }}>
              {verAntigos ? "Ocultar superados" : `Mostrar superados (${superados})`}</Link>}
          </div>
          {visiveis.length === 0 ? <p className="cartao-sub" style={{ marginTop: 8 }}>Nenhum documento enviado.</p> : CATEGORIAS.filter((c) => visiveis.some((d) => d.categoria === c)).map((c) => (
            <div key={c} style={{ marginTop: 14 }}>
              <h3 className="secao-mini">{ROTULO_CATEGORIA[c]}</h3>
              <div className="tabela-caixa"><table className="tabela tabela-compacta">
                <thead><tr><th>Documento</th><th>Número</th><th>Emissão</th><th>Validade</th><th className="dir">Versão</th><th>Situação</th><th aria-label="Arquivo" /></tr></thead>
                <tbody>{visiveis.filter((d) => d.categoria === c).map((d) => (
                  <tr key={d.id} className={d.situacao === "superado" ? "linha-apagada" : d.situacao === "vencido" ? "linha-vencida" : ""}>
                    <td style={{ minWidth: 220 }}><Link href={`/documentos/${d.id}`} className="forte">{d.titulo}</Link>
                      <div className="fraco">{d.tipo}{d.profissional ? ` · ${d.profissional}` : ""}{d.contratoNumero ? ` · contrato ${d.contratoNumero}` : ""}</div></td>
                    <td className="num">{d.numero ?? "—"}{d.conselho && <div className="fraco">{d.conselho}</div>}</td>
                    <td className="num sem-quebra">{dataCurta(d.emissao)}</td>
                    <td className="num sem-quebra">{d.validade ? dataCurta(d.validade) : "—"}</td>
                    <td className="dir num">{d.versao}</td>
                    <td><EtiquetaDocumento situacao={d.situacao} validade={d.validade} /></td>
                    <td className="dir"><a href={`/documentos/arquivo/${d.versaoId}?baixar`} className="botao botao-neutro botao-pequeno" title={`${d.arquivo} · ${tamanhoArquivo(d.tamanho)}`} aria-label={`Baixar ${d.arquivo}`}><Download /></a></td>
                  </tr>
                ))}</tbody>
              </table></div>
            </div>
          ))}
        </section>

        {p.gerados.length > 0 && (
          <section className="cartao">
            <h2 className="cartao-titulo">Gerados pelo sistema</h2>
            <div className="tabela-caixa" style={{ marginTop: 10 }}><table className="tabela tabela-compacta">
              <thead><tr><th>Documento</th><th>Referência</th><th>Data</th></tr></thead>
              <tbody>{grupos.flatMap((g) => p.gerados.filter((x) => x.grupo === g)).map((x) => (
                <tr key={x.href}>
                  <td><Link href={x.href} className="forte">{x.titulo}</Link><div className="fraco">{x.grupo}</div></td>
                  <td className="fraco">{x.detalhe}</td>
                  <td className="num sem-quebra">{x.data ? dataCurta(x.data) : "—"}</td>
                </tr>
              ))}</tbody>
            </table></div>
          </section>
        )}
      </div>
    </>
  );
}
