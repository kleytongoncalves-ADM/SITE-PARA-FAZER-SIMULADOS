import { ErroDeRegra } from "@/lib/db";
import { abaTabela, capa, FORMATO, novaPasta, responderPlanilha, type Linha } from "@/lib/excel-modelo";
import { comoAtor, usuarioAtual } from "@/lib/sessao";
import { PARCELAS_BDI, ROTULO_PARCELA, ROTULO_TIPO_BDI } from "@/servicos/calculo";
import {
  cronogramaDo, curvaAbcInsumos, curvaAbcServicos, insumosDoOrcamento, obterOrcamento, ROTULO_SITUACAO_ORC, rotuloOrcamento,
} from "@/servicos/orcamentos";
import { ROTULO_FONTE, ROTULO_REGIME, ROTULO_TIPO_INSUMO } from "@/servicos/precos";
import { SemPermissao } from "@/servicos/permissoes";
import { unidadeMedida } from "@/lib/formato";

const n = (v: string | null | undefined) => (v == null ? null : Number(v));
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const mesAno = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]}/${m.slice(0, 4)}`;

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await usuarioAtual();
  if (!u) return new Response("Sessão encerrada.", { status: 401 });
  const a = comoAtor(u);
  let o;
  try {
    o = await obterOrcamento(a, id);
  } catch (e) {
    if (e instanceof ErroDeRegra || e instanceof SemPermissao) return new Response(e.message, { status: 404 });
    throw e;
  }
  const [abcS, abcI, analitica] = await Promise.all([curvaAbcServicos(a, id), curvaAbcInsumos(a, id), insumosDoOrcamento(a, id)]);
  const crono = cronogramaDo(o);
  const nota = o.nota ? `${String(o.nota.numero).padStart(4, "0")}/${o.nota.ano}` : null;
  const doc = {
    orgao: u.orgaoNome, titulo: nota ? `Nota de orçamento nº ${nota}` : "Orçamento em elaboração",
    subtitulo: `${o.obraCodigo} · ${o.obraNome} · ${rotuloOrcamento(o)}`, geradoEm: new Date(), geradoPor: u.nome,
  };
  const wb = novaPasta(doc);

  await capa(wb, doc, [
    ["Obra", `${o.obraCodigo} · ${o.obraNome}`],
    ["Orçamento", `${rotuloOrcamento(o)} · ${o.nome}`],
    ["Situação", ROTULO_SITUACAO_ORC[o.situacao]],
    ["Data-base", `${ROTULO_FONTE[o.fonte]} ${o.uf} ${mesAno(o.mes)}`],
    ["Regime", ROTULO_REGIME[o.regime]],
    ["Tipo de obra (BDI)", ROTULO_TIPO_BDI[o.tipoObraBdi]],
    ["Totais", `${o.arredondamento === "truncar" ? "Truncados" : "Arredondados"} em 2 casas`],
    ["Responsável técnico", [o.responsavelTecnico, o.registroProfissional].filter(Boolean).join(" · ")],
    ["ART/RRT", o.art ?? ""],
    ["Aprovado por", o.aprovadoPor ?? ""],
    ...(o.fonte === "demonstracao" ? [["Atenção", "Preços da base de demonstração, ilustrativos. Não usar para contratação."] as [string, string]] : []),
  ], [
    ["Valor global com BDI", Number(o.totais.total)],
    ["Custo direto", Number(o.totais.custo)],
    [`BDI ${o.bdiObraPct.replace(".", ",")}%`, Number(o.totais.bdi)],
    ["Itens", o.etapas.reduce((s, e) => s + e.itens.length, 0), "0"],
  ]);

  await abaTabela(wb, doc, "Resumo", {
    titulo: "Resumo por etapa", paisagem: true,
    colunas: [
      { titulo: "Etapa", largura: 36 }, { titulo: "Material", largura: 15, formato: FORMATO.moeda }, { titulo: "Mão de obra", largura: 15, formato: FORMATO.moeda },
      { titulo: "Equipamento", largura: 15, formato: FORMATO.moeda }, { titulo: "Custo direto", largura: 16, formato: FORMATO.moeda },
      { titulo: "BDI", largura: 15, formato: FORMATO.moeda }, { titulo: "Total com BDI", largura: 17, formato: FORMATO.moeda }, { titulo: "Participação", largura: 12, formato: FORMATO.pct },
    ],
    linhas: [
      ...o.etapas.map((e): Linha => ({ valores: [`${e.ordem}. ${e.nome}`, n(e.totais.material), n(e.totais.maoDeObra), n(e.totais.equipamento), n(e.totais.custo), n(e.totais.bdi), n(e.totais.total),
        Number(o.totais.total) ? (Number(e.totais.total) / Number(o.totais.total)) * 100 : 0] })),
      { tipo: "total", valores: ["Total", n(o.totais.material), n(o.totais.maoDeObra), n(o.totais.equipamento), n(o.totais.custo), n(o.totais.bdi), n(o.totais.total), 100] },
    ],
  });

  await abaTabela(wb, doc, "BDI", {
    titulo: "Composição do BDI", paisagem: false,
    nota: "BDI = [(1 + AC + S + R + G) × (1 + DF) × (1 + L) / (1 − I)] − 1, Acórdão TCU 2.622/2013.",
    colunas: [{ titulo: "Parcela", largura: 40 }, { titulo: "Obra", largura: 14, formato: FORMATO.pct }, { titulo: "Fornecimento", largura: 14, formato: FORMATO.pct }],
    linhas: [
      ...PARCELAS_BDI.map((p): Linha => ({ valores: [ROTULO_PARCELA[p], n(o.bdiObra[p]), n(o.bdiFornecimento[p])] })),
      { tipo: "total", valores: ["BDI calculado", n(o.bdiObraPct), n(o.bdiFornecimentoPct)] },
    ],
  });

  await abaTabela(wb, doc, "Planilha", {
    titulo: "Planilha orçamentária", paisagem: true, nota: "Preço unitário = custo unitário × (1 + BDI).",
    colunas: [
      { titulo: "Item", largura: 8, alinhar: "left" }, { titulo: "Fonte", largura: 13 }, { titulo: "Código", largura: 11 }, { titulo: "Descrição", largura: 58 },
      { titulo: "Und.", largura: 7, alinhar: "center" }, { titulo: "Quant.", largura: 11, formato: FORMATO.quantidade }, { titulo: "Custo unit.", largura: 14, formato: FORMATO.moeda },
      { titulo: "BDI", largura: 12, alinhar: "center" }, { titulo: "Preço unit.", largura: 14, formato: FORMATO.moeda }, { titulo: "Total", largura: 16, formato: FORMATO.moeda },
      { titulo: "Memória de cálculo", largura: 44 },
    ],
    linhas: [
      ...o.etapas.flatMap((e): Linha[] => [
        { tipo: "grupo", valores: [String(e.ordem), "", "", e.nome, "", null, null, "", null, n(e.totais.total), ""] },
        ...e.itens.map((i): Linha => ({ valores: [i.numero, ROTULO_FONTE[i.fonte], i.codigo ?? "", i.descricao, unidadeMedida(i.unidade), n(i.quantidade), i.semPreco ? null : n(i.custoUnitario),
          i.tipoBdi === "fornecimento" ? "Fornecimento" : "Obra", i.semPreco ? null : n(i.precoUnitario), i.semPreco ? null : n(i.total), i.memoria ?? ""] })),
      ]),
      { tipo: "total", valores: ["", "", "", "Valor global", "", null, null, "", null, n(o.totais.total), ""] },
    ],
  });

  const linhasAn: Linha[] = [];
  for (const i of o.etapas.flatMap((e) => e.itens)) {
    const l = analitica.get(i.id) ?? [];
    if (!l.length) continue;
    linhasAn.push({ tipo: "grupo", valores: [i.numero, i.codigo ?? "", `${i.descricao} (${unidadeMedida(i.unidade)})`, "", "", null, null, i.semPreco ? null : n(i.custoUnitario)] });
    for (const x of l) linhasAn.push({ valores: ["", x.codigo, x.descricao, ROTULO_TIPO_INSUMO[x.tipo], unidadeMedida(x.unidade), n(x.coeficiente), n(x.preco), x.preco == null ? null : Number(x.coeficiente) * Number(x.preco)] });
  }
  await abaTabela(wb, doc, "Analítica", {
    titulo: "Composições analíticas", paisagem: true, nota: "Preços congelados na data-base do orçamento.",
    colunas: [
      { titulo: "Item", largura: 8 }, { titulo: "Código", largura: 11 }, { titulo: "Descrição", largura: 58 }, { titulo: "Tipo", largura: 14 }, { titulo: "Und.", largura: 7, alinhar: "center" },
      { titulo: "Coeficiente", largura: 13, formato: FORMATO.coeficiente }, { titulo: "Preço", largura: 13, formato: FORMATO.moeda }, { titulo: "Parcial", largura: 14, formato: FORMATO.moeda },
    ],
    linhas: linhasAn,
  });

  const rot = o.unidadePeriodo === "mes" ? "Mês" : "Semana";
  await abaTabela(wb, doc, "Cronograma", {
    titulo: "Cronograma físico-financeiro", paisagem: true,
    colunas: [{ titulo: "Etapa", largura: 34 }, { titulo: "Total", largura: 16, formato: FORMATO.moeda },
      ...Array.from({ length: o.periodos }, (_, k) => ({ titulo: `${rot} ${k + 1}`, largura: 14, formato: FORMATO.moeda }))],
    linhas: [
      ...o.etapas.map((e, k): Linha => ({ valores: [`${e.ordem}. ${e.nome}`, n(e.totais.total), ...crono.linhas[k].valores.map(n)] })),
      { tipo: "total", valores: ["No período", n(o.totais.total), ...crono.porPeriodo.map(n)] },
      { valores: ["Acumulado", null, ...crono.acumulado.map(n)] },
      { valores: ["Acumulado (%)", null, ...crono.pctAcumulado.map((v) => `${v.replace(".", ",")}%`)] },
    ],
  });

  await abaTabela(wb, doc, "ABC serviços", {
    titulo: "Curva ABC de serviços", paisagem: false, nota: "Classe A: itens que somam os primeiros 80% do valor; B: até 95%; C: o restante.",
    colunas: [{ titulo: "Classe", largura: 8, alinhar: "center" }, { titulo: "Item", largura: 8 }, { titulo: "Código", largura: 11 }, { titulo: "Descrição", largura: 52 },
      { titulo: "Total", largura: 15, formato: FORMATO.moeda }, { titulo: "%", largura: 9, formato: FORMATO.pct }, { titulo: "Acumulado", largura: 11, formato: FORMATO.pct }],
    linhas: abcS.linhas.map((l): Linha => ({ valores: [l.classe, l.numero, l.codigo ?? "", l.descricao, n(l.valor), n(l.percentual), n(l.acumulado)] })),
  });

  await abaTabela(wb, doc, "ABC insumos", {
    titulo: "Curva ABC de insumos", paisagem: true, nota: "Custos sem BDI. Quantidade somada de todos os serviços.",
    colunas: [{ titulo: "Classe", largura: 8, alinhar: "center" }, { titulo: "Código", largura: 11 }, { titulo: "Insumo", largura: 50 }, { titulo: "Tipo", largura: 14 }, { titulo: "Und.", largura: 7, alinhar: "center" },
      { titulo: "Quantidade", largura: 13, formato: "#,##0.0000" }, { titulo: "Preço", largura: 13, formato: FORMATO.moeda }, { titulo: "Custo", largura: 15, formato: FORMATO.moeda },
      { titulo: "%", largura: 9, formato: FORMATO.pct }, { titulo: "Acumulado", largura: 11, formato: FORMATO.pct }],
    linhas: abcI.linhas.map((l): Linha => ({ valores: [l.classe, l.codigo, l.descricao, ROTULO_TIPO_INSUMO[l.tipo], unidadeMedida(l.unidade), n(l.quantidade), n(l.preco), n(l.valor), n(l.percentual), n(l.acumulado)] })),
  });

  return responderPlanilha(wb, `orcamento-${o.obraCodigo}-${rotuloOrcamento(o).replace(" ", "-")}.xlsx`);
}
