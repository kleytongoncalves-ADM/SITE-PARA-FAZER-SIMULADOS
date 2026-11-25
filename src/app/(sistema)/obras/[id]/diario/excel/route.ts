import { ErroDeRegra } from "@/lib/db";
import { abaTabela, capa, FORMATO, novaPasta, responderPlanilha, type Linha } from "@/lib/excel-modelo";
import { dataCurta } from "@/lib/formato";
import { comoAtor, usuarioAtual } from "@/lib/sessao";
import { relatorioDiario, ROTULO_CLIMA, ROTULO_CONDICAO, ROTULO_MOTIVO, ROTULO_OCORRENCIA_DIARIO } from "@/servicos/campo";
import { SemPermissao } from "@/servicos/permissoes";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await usuarioAtual();
  if (!u) return new Response("Sessão encerrada.", { status: 401 });
  const q = new URL(req.url).searchParams;
  let r;
  try {
    r = await relatorioDiario(comoAtor(u), id, q.get("de") ?? "", q.get("ate") ?? "");
  } catch (e) {
    if (e instanceof ErroDeRegra || e instanceof SemPermissao) return new Response(e.message, { status: 404 });
    throw e;
  }
  const periodo = r.de === r.ate ? dataCurta(r.de) : `${dataCurta(r.de)} a ${dataCurta(r.ate)}`;
  const doc = { orgao: u.orgaoNome, titulo: `Diário de obra · ${periodo}`, subtitulo: `${r.obra.codigo} · ${r.obra.nome}`, geradoEm: new Date(), geradoPor: u.nome };
  const wb = novaPasta(doc);
  const horas = r.paradas.reduce((s, p) => s + p.horas, 0);
  await capa(wb, doc, [
    ["Obra", `${r.obra.codigo} · ${r.obra.nome}`],
    ["Período", periodo],
    ["Diários no período", `${r.diasComDiario} (${r.assinados} assinados, ${r.vistados} com visto do fiscal)`],
    ["Dias úteis sem diário", r.diasUteisSemDiario.length ? r.diasUteisSemDiario.map(dataCurta).join(", ") : "Nenhum"],
    ["Dias com chuva", String(r.diasChuva)],
  ], [
    ["Efetivo médio (pessoas)", r.efetivoMedio, "0.0"],
    ["Homens-dia", r.homensDia, "0"],
    ["Horas paradas", horas, "0.0"],
  ]);

  await abaTabela(wb, doc, "Diários", {
    titulo: "Diários do período", paisagem: true,
    colunas: [
      { titulo: "Nº", largura: 6, alinhar: "center" }, { titulo: "Data", largura: 11, alinhar: "center" }, { titulo: "Manhã", largura: 12 }, { titulo: "Tarde", largura: 12 },
      { titulo: "Condição", largura: 16 }, { titulo: "Efetivo", largura: 9, formato: "0" }, { titulo: "Horas paradas", largura: 10, formato: "0.0" },
      { titulo: "Relato", largura: 60 }, { titulo: "Situação", largura: 14 }, { titulo: "Assinado por", largura: 22 }, { titulo: "Visto", largura: 22 },
    ],
    linhas: [
      ...r.diarios.map((d): Linha => ({ valores: [
        d.numero, dataCurta(d.data), ROTULO_CLIMA[d.climaManha], ROTULO_CLIMA[d.climaTarde], ROTULO_CONDICAO[d.condicao], d.totalEfetivo, d.horasParadas,
        d.relato ?? "", d.situacao === "assinado" ? "Assinado" : "Em elaboração", d.assinadoPor ?? "", d.vistoPor ?? "",
      ] })),
      { tipo: "total", valores: ["Total", null, null, null, null, r.homensDia, horas, null, null, null, null] },
    ],
  });

  await abaTabela(wb, doc, "Efetivo", {
    titulo: "Efetivo por dia, função e empresa", paisagem: false,
    colunas: [{ titulo: "Data", largura: 11, alinhar: "center" }, { titulo: "Função", largura: 26 }, { titulo: "Empresa", largura: 30 }, { titulo: "Pessoas", largura: 10, formato: "0" }],
    linhas: [
      ...r.diarios.flatMap((d) => d.efetivo.map((e): Linha => ({ valores: [dataCurta(d.data), e.funcao, e.empresa ?? "", e.quantidade] }))),
      { tipo: "total", valores: ["Homens-dia", null, null, r.homensDia] },
    ],
  });

  await abaTabela(wb, doc, "Serviços", {
    titulo: "Serviços executados", paisagem: true,
    colunas: [{ titulo: "Data", largura: 11, alinhar: "center" }, { titulo: "Atividade", largura: 12 }, { titulo: "Serviço", largura: 60 }, { titulo: "Local", largura: 26 }, { titulo: "Avanço acumulado", largura: 14, formato: FORMATO.pct }],
    linhas: r.diarios.flatMap((d) => d.servicos.map((s): Linha => ({ valores: [dataCurta(d.data), s.atividadeCodigo ?? "", s.descricao, s.local ?? "", s.avancoPct] }))),
  });

  await abaTabela(wb, doc, "Ocorrências", {
    titulo: "Ocorrências, visitas e paralisações", paisagem: true,
    nota: "Paralisações somam os dias parados por motivo, base para prorrogação de prazo.",
    colunas: [{ titulo: "Data", largura: 11, alinhar: "center" }, { titulo: "Tipo", largura: 14 }, { titulo: "Motivo", largura: 20 }, { titulo: "Horas", largura: 9, formato: "0.0" }, { titulo: "Descrição", largura: 70 }],
    linhas: [
      ...r.diarios.flatMap((d) => [
        ...d.ocorrencias.map((o): Linha => ({ valores: [dataCurta(d.data), ROTULO_OCORRENCIA_DIARIO[o.tipo], o.motivo ? ROTULO_MOTIVO[o.motivo] : "", o.horas, o.descricao] })),
        ...d.complementos.map((c): Linha => ({ valores: [dataCurta(d.data), "Complemento", "", null, `${c.texto} (${c.por ?? ""})`] })),
      ]),
      ...r.paradas.map((p): Linha => ({ tipo: "total", valores: [`Parado: ${ROTULO_MOTIVO[p.motivo]}`, null, `${p.dias} ${p.dias === 1 ? "dia" : "dias"}`, p.horas, null] })),
    ],
  });
  return responderPlanilha(wb, `diario-${r.obra.codigo}-${r.de}-a-${r.ate}.xlsx`);
}
