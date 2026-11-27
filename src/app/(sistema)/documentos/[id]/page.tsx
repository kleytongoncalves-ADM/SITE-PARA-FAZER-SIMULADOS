import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Eye, FileCheck2, Replace, Save, Upload } from "lucide-react";
import { BotaoEnviar, FormAcao } from "@/componentes/FormAcao";
import { ErroDeRegra } from "@/lib/db";
import { dataCurta, dataHora, diaLocal } from "@/lib/formato";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { EXIGENCIAS, EXTENSOES_ACEITAS, obterDocumento, ROTULO_CATEGORIA } from "@/servicos/documentos";
import { pode } from "@/servicos/permissoes";
import { acaoBaixarArt, acaoNovaVersao, acaoSalvarDocumento, acaoSuperar } from "../acoes";
import { EtiquetaDocumento, opcoesDocumento, tamanhoArquivo } from "../Apoio";
import { CamposDocumento } from "../CamposDocumento";

export const metadata: Metadata = { title: "Documento" };
const hoje = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const NA_TELA = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

export default async function PaginaDocumento({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ator = comoAtor(await exigirUsuario());
  if (!pode(ator, "documentos.ver")) return <div className="cartao vazio"><b>Seu perfil não acessa os documentos</b></div>;
  let d;
  try { d = await obterDocumento(ator, id); } catch (e) { if (e instanceof ErroDeRegra) notFound(); throw e; }
  const vigente = !d.superadoPor;
  const editavel = d.podeEnviar && vigente;
  const art = d.categoria === "art_rrt";
  const atual = d.versoes[0];

  const ficha: [string, React.ReactNode][] = [
    ["Categoria", ROTULO_CATEGORIA[d.categoria]], ["Tipo", d.tipo], ["Número", d.numero ?? "—"], ["Emissor", d.emissor ?? "—"],
    ["Emissão", d.emissao ? dataCurta(d.emissao) : "—"], ["Validade", d.validade ? dataCurta(d.validade) : "Sem validade"],
    ["Contrato", d.contratoNumero ? <Link href={`/contratos/${d.contratoId}`}>{d.contratoNumero}</Link> : "Da obra"],
    ["Exigência atendida", d.exigencia ? EXIGENCIAS[d.exigencia].rotulo : "—"],
  ];
  if (art) ficha.push(["Conselho", d.conselho ?? "—"], ["Profissional", d.profissional ?? "—"], ["Registro", d.registro ?? "—"], ["Atividade técnica", d.atividade ?? "—"],
    ["Baixa", d.baixadaEm ? dataCurta(d.baixadaEm) : "Em aberto"]);

  return (
    <>
      <div className="cabecalho">
        <div style={{ minWidth: 0 }}>
          <div className="sobretitulo">
            <Link href="/documentos">Documentos</Link><span>/</span><Link href={`/obras/${d.obra.id}/documentos`} className="num">{d.obra.codigo}</Link>
          </div>
          <h1 className="titulo">{d.titulo}</h1>
          <p className="subtitulo" style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <EtiquetaDocumento situacao={d.situacao} validade={d.validade} />
            <span>{d.tipo} · versão {d.versao}</span>
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {NA_TELA.includes(atual.mime) && <a href={`/documentos/arquivo/${atual.id}`} target="_blank" rel="noopener" className="botao botao-neutro"><Eye /> Abrir</a>}
          <a href={`/documentos/arquivo/${atual.id}?baixar`} className="botao botao-primario"><Download /> Baixar</a>
        </div>
      </div>

      {d.superadoPor && (
        <div className="aviso aviso-info" style={{ marginBottom: 14 }}>
          <span>Superado por <Link href={`/documentos/${d.superadoPor}`} className="forte">{d.superadoPorTitulo}</Link> em {dataCurta(diaLocal(d.superadoEm!))}. Motivo: {d.superadoMotivo}</span>
        </div>
      )}

      <div className="grade">
        <section className="cartao">
          <h2 className="cartao-titulo">Dados do documento</h2>
          <dl className="dados" style={{ marginTop: 12 }}>
            {ficha.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
          {d.superadoDe.length > 0 && (
            <p className="cartao-sub" style={{ marginTop: 10 }}>Substitui {d.superadoDe.map((s, i) => <span key={s.id}>{i ? ", " : ""}<Link href={`/documentos/${s.id}`}>{s.titulo}</Link></span>)}.</p>
          )}
          {editavel && (
            <details className="detalhe-acao">
              <summary>Editar dados</summary>
              <FormAcao acao={acaoSalvarDocumento.bind(null, d.obra.id, d.id)} className="grade-form" style={{ marginTop: 10 }}>
                <CamposDocumento prefixo="ed" categoriaFixa opcoes={opcoesDocumento(d.contratos, null)} valores={d} />
                <div className="c12 rodape-form"><BotaoEnviar enviando="Salvando…"><Save /> Salvar</BotaoEnviar></div>
              </FormAcao>
            </details>
          )}
        </section>

        <section className="cartao">
          <h2 className="cartao-titulo">Versões</h2>
          <div className="tabela-caixa" style={{ marginTop: 10 }}><table className="tabela tabela-compacta">
            <thead><tr><th className="dir">Versão</th><th>Arquivo</th><th>O que mudou</th><th>Enviado</th><th>SHA-256</th><th aria-label="Arquivo" /></tr></thead>
            <tbody>{d.versoes.map((v) => (
              <tr key={v.id} className={v.id === atual.id ? "" : "linha-apagada"}>
                <td className="dir num forte">{v.numero}</td>
                <td style={{ minWidth: 160 }}>{v.arquivo}<div className="fraco">{tamanhoArquivo(v.tamanho)}</div></td>
                <td>{v.mudanca ?? "—"}</td>
                <td className="sem-quebra">{dataHora(new Date(v.em))}<div className="fraco">{v.por ?? ""}</div></td>
                <td><code className="hash" title={v.sha256}>{v.sha256.slice(0, 12)}…</code></td>
                <td className="dir"><a href={`/documentos/arquivo/${v.id}?baixar`} className="botao botao-neutro botao-pequeno" aria-label={`Baixar versão ${v.numero}`}><Download /></a></td>
              </tr>
            ))}</tbody>
          </table></div>
          {editavel && (
            <details className="detalhe-acao">
              <summary>Enviar nova versão</summary>
              <FormAcao acao={acaoNovaVersao.bind(null, d.obra.id, d.id)} className="grade-form" style={{ marginTop: 10 }} limpar>
                <div className="campo c6"><label htmlFor="nv-arq">Arquivo</label><input id="nv-arq" name="arquivo" type="file" accept={EXTENSOES_ACEITAS} className="entrada-texto" required /></div>
                <div className="campo c6"><label htmlFor="nv-m">O que mudou</label><input id="nv-m" name="mudanca" className="entrada-texto" required placeholder="Revisão 01: ajuste das cotas do pavimento térreo" /></div>
                <div className="c12 rodape-form"><BotaoEnviar enviando="Enviando…"><Upload /> Enviar versão</BotaoEnviar></div>
              </FormAcao>
            </details>
          )}
        </section>

        {editavel && (art && !d.baixadaEm || d.substitutos.length > 0) && (
          <section className="cartao">
            <h2 className="cartao-titulo">Encerramento</h2>
            <div className="diario-colunas" style={{ marginTop: 10 }}>
              {art && !d.baixadaEm && (
                <FormAcao acao={acaoBaixarArt.bind(null, d.obra.id, d.id)} className="grade-form" confirmar="Registrar a baixa da ART ou RRT? A baixa não se desfaz.">
                  <div className="campo c12"><label htmlFor="bx-d">Data da baixa no conselho</label><input id="bx-d" name="data" type="date" max={hoje()} defaultValue={hoje()} className="entrada-texto" required /></div>
                  <div className="c12 rodape-form"><BotaoEnviar className="botao botao-neutro" enviando="Registrando…"><FileCheck2 /> Registrar baixa</BotaoEnviar></div>
                </FormAcao>
              )}
              {d.substitutos.length > 0 && (
                <FormAcao acao={acaoSuperar.bind(null, d.obra.id, d.id)} className="grade-form" confirmar="Marcar este documento como superado? Ele deixa de valer e não recebe novas versões.">
                  <div className="campo c12"><label htmlFor="sp-s">Substituído por</label>
                    <select id="sp-s" name="substitutoId" className="entrada-texto" required defaultValue="">
                      <option value="" disabled>Escolha</option>
                      {d.substitutos.map((s) => <option key={s.id} value={s.id}>{s.titulo} · {s.tipo}</option>)}
                    </select></div>
                  <div className="campo c12"><label htmlFor="sp-m">Motivo</label><input id="sp-m" name="motivo" className="entrada-texto" required placeholder="Renovação, revisão de projeto, cancelamento…" /></div>
                  <div className="c12 rodape-form"><BotaoEnviar className="botao botao-neutro" enviando="Registrando…"><Replace /> Marcar como superado</BotaoEnviar></div>
                </FormAcao>
              )}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
