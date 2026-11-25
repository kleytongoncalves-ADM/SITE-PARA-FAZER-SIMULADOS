import { ErroDeRegra } from "@/lib/db";
import { abaTabela, capa, FORMATO, novaPasta, responderPlanilha, type Linha } from "@/lib/excel-modelo";
import { dataCurta } from "@/lib/formato";
import { comoAtor, usuarioAtual } from "@/lib/sessao";
import { SemPermissao } from "@/servicos/permissoes";
import { painelQualidade, ROTULO_GRAVIDADE, ROTULO_ORIGEM_NC, ROTULO_RESPOSTA, ROTULO_SITUACAO_NC, rotuloNc } from "@/servicos/qualidade";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await usuarioAtual();
  if (!u) return new Response("Sessão encerrada.", { status: 401 });
  let p;
  try {
    p = await painelQualidade(comoAtor(u), id);
  } catch (e) {
    if (e instanceof ErroDeRegra || e instanceof SemPermissao) return new Response(e.message, { status: 404 });
    throw e;
  }
  const doc = { orgao: u.orgaoNome, titulo: `Qualidade · ${p.obra.codigo}`, subtitulo: p.obra.nome, geradoEm: new Date(), geradoPor: u.nome };
  const wb = novaPasta(doc);
  await capa(wb, doc, [
    ["Obra", `${p.obra.codigo} · ${p.obra.nome}`],
    ["Não conformidades", `${p.abertas} abertas, ${p.aguardando} aguardando verificação, ${p.encerradas} encerradas`],
    ["Prazo vencido", String(p.vencidas)], ["Travando medição", String(p.impeditivas)],
    ["Ensaios", `${p.ensaios.length} (${p.ensaiosReprovados} reprovados)`],
  ], [
    ["Em aberto", p.abertas + p.aguardando, "0"], ["Vencidas", p.vencidas, "0"], ["Conformidade (%)", p.conformidade ?? 0, FORMATO.pct],
  ]);
  await abaTabela(wb, doc, "Não conformidades", {
    titulo: "Não conformidades", paisagem: true,
    colunas: [
      { titulo: "NC", largura: 9 }, { titulo: "Título", largura: 36 }, { titulo: "Descrição", largura: 50 }, { titulo: "Local", largura: 18 }, { titulo: "Item", largura: 9 },
      { titulo: "Gravidade", largura: 11 }, { titulo: "Impeditiva", largura: 10 }, { titulo: "Responsável", largura: 20 }, { titulo: "Prazo", largura: 11, alinhar: "center" },
      { titulo: "Situação", largura: 20 }, { titulo: "Origem", largura: 12 }, { titulo: "Dias em aberto", largura: 10, formato: "0" }, { titulo: "Correção", largura: 40 }, { titulo: "Verificação", largura: 40 },
    ],
    linhas: p.ncs.map((x): Linha => ({ valores: [
      rotuloNc(x), x.titulo, x.descricao, x.local ?? "", x.itemNumero ?? "", ROTULO_GRAVIDADE[x.gravidade], x.impeditiva ? "Sim" : "Não", x.responsavel,
      dataCurta(x.prazo), ROTULO_SITUACAO_NC[x.situacao] + (x.vencida ? " (vencido)" : ""), ROTULO_ORIGEM_NC[x.origem], x.diasEmAberto, x.correcao ?? "", x.verificacao ?? "",
    ] })),
  });
  await abaTabela(wb, doc, "Inspeções", {
    titulo: "Inspeções por checklist", paisagem: true,
    colunas: [{ titulo: "Nº", largura: 6 }, { titulo: "Checklist", largura: 26 }, { titulo: "Data", largura: 11, alinhar: "center" }, { titulo: "Local", largura: 20 }, { titulo: "Item verificado", largura: 50 }, { titulo: "Resultado", largura: 14 }, { titulo: "Observação", largura: 40 }],
    linhas: p.inspecoes.flatMap((i) => [
      { tipo: "grupo", valores: [i.numero, i.titulo, dataCurta(i.data), i.local ?? "", `${i.conformes} conformes, ${i.naoConformes} não conformes`, null, null] } as Linha,
      ...i.respostas.map((r): Linha => ({ valores: [null, null, null, null, r.pergunta, ROTULO_RESPOSTA[r.resposta], r.observacao ?? ""] })),
    ]),
  });
  await abaTabela(wb, doc, "Ensaios", {
    titulo: "Ensaios", paisagem: true,
    colunas: [{ titulo: "Nº", largura: 6 }, { titulo: "Ensaio", largura: 36 }, { titulo: "Local", largura: 20 }, { titulo: "Item", largura: 9 }, { titulo: "Coleta", largura: 11, alinhar: "center" }, { titulo: "Resultado em", largura: 12, alinhar: "center" },
      { titulo: "Critério", largura: 10 }, { titulo: "Especificado", largura: 12, formato: "#,##0.00" }, { titulo: "Resultado", largura: 12, formato: "#,##0.00" }, { titulo: "Unidade", largura: 9 }, { titulo: "Situação", largura: 12 }, { titulo: "Laboratório", largura: 20 }, { titulo: "Laudo", largura: 12 }],
    linhas: p.ensaios.map((e): Linha => ({ valores: [e.numero, e.tipo, e.local ?? "", e.itemNumero ?? "", dataCurta(e.dataColeta), dataCurta(e.dataResultado), e.criterio === "minimo" ? "Mínimo" : "Máximo",
      Number(e.especificado), Number(e.resultado), e.unidade, e.aprovado ? "Aprovado" : "Reprovado", e.laboratorio ?? "", e.laudo ?? ""] })),
  });
  return responderPlanilha(wb, `qualidade-${p.obra.codigo}.xlsx`);
}
