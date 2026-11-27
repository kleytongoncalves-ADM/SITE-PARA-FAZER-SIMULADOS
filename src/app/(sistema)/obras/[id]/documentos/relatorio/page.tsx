import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileSpreadsheet } from "lucide-react";
import { BotaoImprimir } from "@/componentes/BotaoImprimir";
import { CabecalhoRelatorio, Indicadores, RodapeRelatorio, Secao } from "@/componentes/relatorio/Estrutura";
import { ErroDeRegra } from "@/lib/db";
import { dataCurta, dataHora, diaLocal } from "@/lib/formato";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { AVISO_DIAS, CATEGORIAS, documentosDaObra, ROTULO_CATEGORIA, type SituacaoDocumento } from "@/servicos/documentos";
import { SemPermissao } from "@/servicos/permissoes";

export const metadata: Metadata = { title: "Relatório de documentos da obra" };
const SITUACAO: Record<SituacaoDocumento, string> = { vigente: "Vigente", vencendo: "Vence em breve", vencido: "Vencido", superado: "Superado", baixada: "Baixada" };

export default async function RelatorioDocumentos({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await exigirUsuario();
  let p;
  try {
    p = await documentosDaObra(comoAtor(u), id);
  } catch (e) {
    if (e instanceof ErroDeRegra || e instanceof SemPermissao) notFound();
    throw e;
  }
  const vigentes = p.documentos.filter((d) => d.situacao !== "superado");
  const superados = p.documentos.filter((d) => d.situacao === "superado");
  const faltando = p.exigencias.filter((e) => !e.atendida);
  const dispensadas = p.exigencias.filter((e) => e.dispensa);
  const arts = vigentes.filter((d) => d.categoria === "art_rrt");
  const pontos: string[] = [];
  pontos.push(`${vigentes.length} ${vigentes.length === 1 ? "documento vigente" : "documentos vigentes"} e ${superados.length} ${superados.length === 1 ? "superado" : "superados"} no histórico.`);
  pontos.push(`${p.exigencias.length - faltando.length} de ${p.exigencias.length} exigências documentais atendidas${dispensadas.length ? `, ${dispensadas.length} por dispensa justificada` : ""}.`);
  if (faltando.length) pontos.push(`Faltando: ${faltando.map((e) => e.rotulo).join(", ")}${p.ativa ? "" : " (cobradas a partir do início da execução)"}.`);
  if (p.vencidos) pontos.push(`${p.vencidos} ${p.vencidos === 1 ? "documento vencido" : "documentos vencidos"}.`);
  if (p.vencendo) pontos.push(`${p.vencendo} ${p.vencendo === 1 ? "documento vence" : "documentos vencem"} nos próximos ${AVISO_DIAS} dias.`);
  const grave = p.vencidos > 0 || (p.ativa && p.pendentes > 0);
  let s = 0;
  const n = () => ++s;

  return (
    <div className="grade">
      <div className="barra-acoes nao-imprimir">
        <Link href={`/obras/${id}/documentos`} className="botao botao-neutro"><ArrowLeft /> Voltar</Link>
        <a href={`/obras/${id}/documentos/excel`} className="botao botao-neutro"><FileSpreadsheet /> Excel</a>
        <BotaoImprimir />
      </div>
      <article className="rel">
        <CabecalhoRelatorio orgao={u.orgaoNome} tipo="Relatório de documentos da obra" titulo={`Documentos · ${p.obra.codigo}`} subtitulo={p.obra.nome}
          selo={{ texto: grave ? "Pendências documentais" : p.vencendo ? "Validades a vencer" : "Documentação regular", cor: grave ? "vermelho" : p.vencendo ? "laranja" : "verde" }}
          dados={[["Obra", `${p.obra.codigo} · ${p.obra.nome}`], ["Posição em", dataHora(new Date())], ["Documentos vigentes", String(vigentes.length)], ["Emitido por", u.nome]]} />

        <Secao numero={n()} titulo="Resumo executivo">
          <Indicadores itens={[
            { rotulo: "Exigências atendidas", valor: `${p.exigencias.length - faltando.length} de ${p.exigencias.length}`, destaque: true },
            { rotulo: "Documentos vigentes", valor: String(vigentes.length) },
            { rotulo: "Vencidos", valor: String(p.vencidos) },
            { rotulo: `Vencem em ${AVISO_DIAS} dias`, valor: String(p.vencendo) },
            { rotulo: "ART e RRT", valor: String(arts.length) },
          ]} />
          <ul className="rel-pontos">{pontos.map((x) => <li key={x}>{x}</li>)}</ul>
        </Secao>

        <Secao numero={n()} titulo="Exigências documentais">
          <table className="rel-tabela">
            <thead><tr><th>Exigência</th><th>Atendida por</th><th>Situação</th></tr></thead>
            <tbody>{p.exigencias.map((e) => (
              <tr key={e.chave}><td>{e.rotulo}</td>
                <td>{e.documento ? e.documento.titulo : e.dispensa ? `Dispensa: ${e.dispensa.justificativa}` : "—"}</td>
                <td className={!e.atendida ? "forte" : ""}>{e.documento ? SITUACAO[e.documento.situacao] : e.dispensa ? `Dispensada em ${dataCurta(diaLocal(e.dispensa.em))}` : "Pendente"}</td></tr>
            ))}</tbody>
          </table>
        </Secao>

        {arts.length > 0 && (
          <Secao numero={n()} titulo="Responsabilidade técnica (ART e RRT)">
            <table className="rel-tabela">
              <thead><tr><th>Tipo</th><th>Número</th><th>Conselho</th><th>Profissional</th><th>Registro</th><th>Atividade</th><th>Baixa</th></tr></thead>
              <tbody>{arts.map((d) => (
                <tr key={d.id}><td>{d.tipo}</td><td className="num">{d.numero}</td><td>{d.conselho}</td><td>{d.profissional}</td><td className="num">{d.registro ?? "—"}</td><td>{d.atividade ?? "—"}</td><td className="num">{d.baixadaEm ? dataCurta(d.baixadaEm) : "Em aberto"}</td></tr>
              ))}</tbody>
            </table>
          </Secao>
        )}

        <Secao numero={n()} titulo="Documentos vigentes por categoria">
          {vigentes.length === 0 ? <p className="fraco">Nenhum documento enviado.</p> : (
            <table className="rel-tabela">
              <thead><tr><th>Categoria</th><th>Documento</th><th>Número</th><th>Emissão</th><th>Validade</th><th className="dir">Versão</th><th>Situação</th></tr></thead>
              <tbody>{CATEGORIAS.flatMap((c) => vigentes.filter((d) => d.categoria === c)).map((d) => (
                <tr key={d.id}><td>{ROTULO_CATEGORIA[d.categoria]}</td><td>{d.titulo}<div className="fraco">{d.tipo}</div></td><td className="num">{d.numero ?? "—"}</td>
                  <td className="num">{dataCurta(d.emissao)}</td><td className="num">{d.validade ? dataCurta(d.validade) : "—"}</td><td className="dir num">{d.versao}</td>
                  <td className={d.situacao === "vencido" ? "forte" : ""}>{SITUACAO[d.situacao]}</td></tr>
              ))}</tbody>
            </table>
          )}
        </Secao>

        {superados.length > 0 && (
          <Secao numero={n()} titulo="Histórico de substituições">
            <table className="rel-tabela">
              <thead><tr><th>Documento superado</th><th>Substituído por</th><th>Data</th><th>Motivo</th></tr></thead>
              <tbody>{superados.map((d) => (
                <tr key={d.id}><td>{d.titulo}</td><td>{d.superadoPorTitulo}</td><td className="num">{d.superadoEm ? dataCurta(diaLocal(d.superadoEm)) : "—"}</td><td>{d.superadoMotivo}</td></tr>
              ))}</tbody>
            </table>
          </Secao>
        )}

        <Secao numero={n()} titulo="Metodologia e fontes">
          <ul className="rel-metodologia">
            <li><b>Exigências:</b> ART ou RRT de projeto e de execução, alvará de obra e licença ambiental em toda obra; ART ou RRT de fiscalização e ordem de serviço quando há contratada. Cada exigência é atendida por documento vigente ou por dispensa justificada.</li>
            <li><b>Validade:</b> vencido após a data de validade; “vence em breve” quando faltam até {AVISO_DIAS} dias.</li>
            <li><b>Versões:</b> cada arquivo enviado é guardado com o resumo SHA-256 e não pode ser alterado nem excluído; revisões entram como nova versão.</li>
            <li><b>Fonte:</b> documentos, versões e dispensas registrados no sistema para esta obra.</li>
          </ul>
        </Secao>
        <RodapeRelatorio texto={`CiviObras · ${u.orgaoNome} · ${p.obra.codigo} · relatório de documentos · gerado em ${dataHora(new Date())}`} />
      </article>
    </div>
  );
}
