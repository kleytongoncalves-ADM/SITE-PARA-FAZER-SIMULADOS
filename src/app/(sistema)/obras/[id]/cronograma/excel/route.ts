import { ErroDeRegra } from "@/lib/db";
import { abaTabela, capa, FORMATO, novaPasta, responderPlanilha, type Linha } from "@/lib/excel-modelo";
import { dataCurta } from "@/lib/formato";
import { comoAtor, usuarioAtual } from "@/lib/sessao";
import { ROTULO_SITUACAO_CRONO, obterCronograma } from "@/servicos/cronogramas";
import { obterObra } from "@/servicos/obras";
import { SemPermissao } from "@/servicos/permissoes";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const versao = new URL(req.url).searchParams.get("versao") ?? "";
  const u = await usuarioAtual();
  if (!u) return new Response("Sessão encerrada.", { status: 401 });
  const a = comoAtor(u);
  let c, obra;
  try {
    obra = await obterObra(a, id);
    c = await obterCronograma(a, versao);
    if (c.obraId !== obra.id) throw new ErroDeRegra("Cronograma não encontrado.");
  } catch (e) {
    if (e instanceof ErroDeRegra || e instanceof SemPermissao) return new Response(e.message, { status: 404 });
    throw e;
  }
  const base = c.situacao === "linha_base";
  const doc = {
    orgao: u.orgaoNome, titulo: `Cronograma · versão ${c.versao}`,
    subtitulo: `${obra.codigo} · ${obra.nome} · contrato ${c.contratoNumero} · ${ROTULO_SITUACAO_CRONO[c.situacao]}`, geradoEm: new Date(), geradoPor: u.nome,
  };
  const wb = novaPasta(doc);
  await capa(wb, doc, [
    ["Obra", `${obra.codigo} · ${obra.nome}`],
    ["Contrato", c.contratoNumero],
    ["Versão", `${c.versao} · ${ROTULO_SITUACAO_CRONO[c.situacao]}`],
    ["Calendário", c.calendario === "uteis" ? "Dias úteis, sem fins de semana e feriados" : "Dias corridos"],
    ["Início", dataCurta(c.inicio)],
    ["Término", dataCurta(c.termino)],
    ["Fim do prazo contratual", dataCurta(c.fimContrato)],
    ["Linha de base", c.linhaBaseEm ? `${c.linhaBasePor ?? ""} em ${new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short" }).format(c.linhaBaseEm)}` : "Não gravada"],
    ...(c.motivo ? [["Motivo da versão", c.motivo] as [string, string]] : []),
  ], [
    ["Valor programado", c.indicadores.total],
    ["Prazo (dias)", c.prazoDias, "0"],
    ["Atividades críticas", c.criticas, "0"],
    ...(base ? [["Executado", c.indicadores.realizadoPct, FORMATO.pct] as [string, number, string]] : []),
  ]);

  await abaTabela(wb, doc, "Atividades", {
    titulo: "Atividades e caminho crítico", paisagem: true,
    nota: "Folga em dias de trabalho. Atividade crítica: sem folga; qualquer atraso move o término da obra.",
    colunas: [
      { titulo: "Código", largura: 9 }, { titulo: "Atividade", largura: 46 }, { titulo: "Dias", largura: 7, formato: "0" },
      { titulo: "Início", largura: 11, alinhar: "center" }, { titulo: "Fim", largura: 11, alinhar: "center" }, { titulo: "Folga", largura: 7, formato: "0" },
      { titulo: "Crítica", largura: 8, alinhar: "center" }, { titulo: "Predecessoras", largura: 16 }, { titulo: "Item", largura: 8 },
      { titulo: "Valor", largura: 15, formato: FORMATO.moeda }, { titulo: "Peso", largura: 9, formato: FORMATO.pct },
      ...(base ? [{ titulo: "Executado", largura: 11, formato: FORMATO.pct }] : []),
    ],
    linhas: [
      ...c.atividades.map((x): Linha => ({ valores: [
        x.codigo, x.nome, x.duracao, dataCurta(x.inicio), dataCurta(x.fim), x.folga, x.critica ? "Sim" : "Não", x.predecessorasTexto, x.itemNumero ?? "",
        Number(x.valor), x.peso, ...(base ? [x.avancoAtual] : []),
      ] })),
      { tipo: "total", valores: ["Total", null, null, null, null, null, null, null, null, c.indicadores.total, 100, ...(base ? [c.indicadores.realizadoPct] : [])] },
    ],
  });

  await abaTabela(wb, doc, "Curva S", {
    titulo: "Curva S física e financeira", paisagem: false,
    colunas: [
      { titulo: "Período", largura: 12 }, { titulo: "Início", largura: 12, alinhar: "center" }, { titulo: "Fim", largura: 12, alinhar: "center" },
      { titulo: "Previsto", largura: 15, formato: FORMATO.moeda }, { titulo: "Previsto acum.", largura: 13, formato: FORMATO.pct },
      { titulo: "Realizado", largura: 15, formato: FORMATO.moeda }, { titulo: "Realizado acum.", largura: 13, formato: FORMATO.pct },
    ],
    linhas: c.curva.map((p): Linha => ({ valores: [p.rotulo, dataCurta(p.inicio), dataCurta(p.fim), p.previsto, p.previstoPct, p.realizado, p.realizadoPct] })),
  });
  return responderPlanilha(wb, `cronograma-${obra.codigo}-v${c.versao}.xlsx`);
}
