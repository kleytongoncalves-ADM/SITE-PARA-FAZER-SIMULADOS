import { ErroDeRegra } from "@/lib/db";
import { abaTabela, capa, novaPasta, responderPlanilha, type Linha } from "@/lib/excel-modelo";
import { dataCurta } from "@/lib/formato";
import { comoAtor, usuarioAtual } from "@/lib/sessao";
import { documentosDaObra, ROTULO_CATEGORIA, type SituacaoDocumento } from "@/servicos/documentos";
import { SemPermissao } from "@/servicos/permissoes";

const SITUACAO: Record<SituacaoDocumento, string> = { vigente: "Vigente", vencendo: "Vence em breve", vencido: "Vencido", superado: "Superado", baixada: "Baixada" };
const data = (d: Date | null) => (d ? dataCurta(new Date(d).toISOString().slice(0, 10)) : "");

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await usuarioAtual();
  if (!u) return new Response("Sessão encerrada.", { status: 401 });
  let p;
  try {
    p = await documentosDaObra(comoAtor(u), id);
  } catch (e) {
    if (e instanceof ErroDeRegra || e instanceof SemPermissao) return new Response(e.message, { status: 404 });
    throw e;
  }
  const vigentes = p.documentos.filter((d) => d.situacao !== "superado");
  const doc = { orgao: u.orgaoNome, titulo: `Documentos · ${p.obra.codigo}`, subtitulo: p.obra.nome, geradoEm: new Date(), geradoPor: u.nome };
  const wb = novaPasta(doc);
  await capa(wb, doc, [
    ["Obra", `${p.obra.codigo} · ${p.obra.nome}`],
    ["Exigências atendidas", `${p.exigencias.filter((e) => e.atendida).length} de ${p.exigencias.length}`],
  ], [["Documentos vigentes", vigentes.length, "0"], ["Vencidos", p.vencidos, "0"], ["Vencem em 30 dias", p.vencendo, "0"]]);
  await abaTabela(wb, doc, "Exigências", {
    titulo: "Exigências documentais", paisagem: false,
    colunas: [{ titulo: "Exigência", largura: 30 }, { titulo: "Atendida por", largura: 50 }, { titulo: "Situação", largura: 18 }],
    linhas: p.exigencias.map((e): Linha => ({ valores: [e.rotulo, e.documento ? e.documento.titulo : e.dispensa ? `Dispensa: ${e.dispensa.justificativa}` : "",
      e.documento ? SITUACAO[e.documento.situacao] : e.dispensa ? "Dispensada" : "Pendente"] })),
  });
  await abaTabela(wb, doc, "Documentos", {
    titulo: "Documentos da obra", paisagem: true,
    colunas: [
      { titulo: "Categoria", largura: 20 }, { titulo: "Tipo", largura: 26 }, { titulo: "Título", largura: 36 }, { titulo: "Número", largura: 16 }, { titulo: "Emissor", largura: 18 },
      { titulo: "Emissão", largura: 11, alinhar: "center" }, { titulo: "Validade", largura: 11, alinhar: "center" }, { titulo: "Contrato", largura: 14 },
      { titulo: "Profissional", largura: 24 }, { titulo: "Conselho", largura: 9 }, { titulo: "Versão", largura: 7, formato: "0" }, { titulo: "Arquivo", largura: 30 },
      { titulo: "Situação", largura: 14 }, { titulo: "Superado por", largura: 30 },
    ],
    linhas: p.documentos.map((d): Linha => ({ valores: [ROTULO_CATEGORIA[d.categoria], d.tipo, d.titulo, d.numero ?? "", d.emissor ?? "", d.emissao ? dataCurta(d.emissao) : "",
      d.validade ? dataCurta(d.validade) : "", d.contratoNumero ?? "", d.profissional ?? "", d.conselho ?? "", d.versao, d.arquivo, SITUACAO[d.situacao],
      d.superadoPorTitulo ? `${d.superadoPorTitulo} (${data(d.superadoEm)}): ${d.superadoMotivo}` : ""] })),
  });
  return responderPlanilha(wb, `documentos-${p.obra.codigo}.xlsx`);
}
