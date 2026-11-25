import { ErroDeRegra } from "@/lib/db";
import { abaTabela, capa, FORMATO, novaPasta, responderPlanilha, type Linha } from "@/lib/excel-modelo";
import { dataCurta } from "@/lib/formato";
import { comoAtor, usuarioAtual } from "@/lib/sessao";
import {
  formatarCnpj, obterContrato, ROTULO_EXECUTOR, ROTULO_MODALIDADE, ROTULO_NATUREZA, ROTULO_REGIME_EXECUCAO, ROTULO_SITUACAO_CONTRATO, rotuloContrato,
} from "@/servicos/contratos";
import { SemPermissao } from "@/servicos/permissoes";
import { ROTULO_FONTE } from "@/servicos/precos";

const n = (v: string | null | undefined) => (v == null ? null : Number(v));

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await usuarioAtual();
  if (!u) return new Response("Sessão encerrada.", { status: 401 });
  let k;
  try {
    k = await obterContrato(comoAtor(u), id);
  } catch (e) {
    if (e instanceof ErroDeRegra || e instanceof SemPermissao) return new Response(e.message, { status: 404 });
    throw e;
  }
  const doc = {
    orgao: u.orgaoNome, titulo: `${rotuloContrato(k)} · planilha contratual`,
    subtitulo: `${k.obraCodigo} · ${k.obraNome} · ${ROTULO_SITUACAO_CONTRATO[k.situacao]}`, geradoEm: new Date(), geradoPor: u.nome,
  };
  const wb = novaPasta(doc);
  await capa(wb, doc, [
    ["Obra", `${k.obraCodigo} · ${k.obraNome}`],
    ["Objeto", k.objeto],
    ["Contratada", k.empresaNome ? `${k.empresaNome} · CNPJ ${formatarCnpj(k.empresaCnpj!)}` : "Equipe própria"],
    ["Regime de execução", ROTULO_REGIME_EXECUCAO[k.regime]],
    ["Situação", ROTULO_SITUACAO_CONTRATO[k.situacao]],
    ["Processo", k.processo ?? ""],
    ["Assinatura", dataCurta(k.dataAssinatura)],
    ["Ordem de serviço", dataCurta(k.dataOrdemServico)],
    ["Prazo de execução", k.prazoExecucaoDias ? `${k.prazoExecucaoDias} dias corridos, até ${dataCurta(k.fimExecucao)}` : ""],
    ["Fim da vigência", dataCurta(k.vigenciaFim)],
    ["Reajuste", k.indiceReajuste ? `${k.indiceReajuste}, data-base ${dataCurta(k.dataBase)}` : "Sem reajuste"],
    ["Limite de acréscimo", `${k.limiteAditivo}% (${ROTULO_NATUREZA[k.natureza].toLowerCase()})`],
    ["Gestor do contrato", k.gestorNome ?? ""],
    ["Fiscal", k.fiscalNome ?? ""],
    ["Orçamento de origem", `${k.orcamentoRotulo} · ${k.orcamentoNome}`],
  ], [
    ["Valor do contrato", Number(k.valorInicial)],
    ["Valor orçado", Number(k.valorOrcado)],
    ["Desconto da proposta", Number(k.desconto), FORMATO.pct],
    ["Itens", k.itens.length, "0"],
  ]);

  await abaTabela(wb, doc, "Planilha", {
    titulo: "Planilha contratual", paisagem: true,
    nota: Number(k.desconto) > 0 ? `Preço unitário = preço do orçamento com desconto de ${k.desconto.replace(".", ",")}% da proposta.` : undefined,
    colunas: [
      { titulo: "Item", largura: 8, alinhar: "left" }, { titulo: "Fonte", largura: 13 }, { titulo: "Código", largura: 12 }, { titulo: "Descrição", largura: 58 },
      { titulo: "Und.", largura: 7 }, { titulo: "Quantidade", largura: 12, formato: FORMATO.quantidade }, { titulo: "Preço unitário", largura: 15, formato: FORMATO.moeda },
      { titulo: "Total", largura: 16, formato: FORMATO.moeda }, { titulo: "Executor", largura: 15 },
    ],
    linhas: [
      ...k.etapas.flatMap((e): Linha[] => [
        { tipo: "grupo", valores: [e.nome, null, null, null, null, null, null, n(e.total), null] },
        ...e.itens.map((i): Linha => ({ valores: [i.numero, ROTULO_FONTE[i.fonte], i.codigo ?? "", i.descricao, i.unidade, n(i.quantidade), n(i.precoUnitario), n(i.total), ROTULO_EXECUTOR[i.executor]] })),
      ]),
      { tipo: "total", valores: ["Valor do contrato", null, null, null, null, null, null, n(k.valorInicial), null] },
    ],
  });

  if (k.garantias.length) {
    await abaTabela(wb, doc, "Garantias", {
      titulo: "Garantias contratuais", paisagem: false,
      colunas: [
        { titulo: "Modalidade", largura: 22 }, { titulo: "Instituição", largura: 26 }, { titulo: "Documento", largura: 18 },
        { titulo: "Início", largura: 12 }, { titulo: "Vencimento", largura: 12 }, { titulo: "Valor", largura: 16, formato: FORMATO.moeda },
      ],
      linhas: [
        ...k.garantias.map((g): Linha => ({ valores: [ROTULO_MODALIDADE[g.modalidade], g.instituicao ?? "", g.documento ?? "", dataCurta(g.inicio), dataCurta(g.vencimento), n(g.valor)] })),
        { tipo: "total", valores: [`Total (${k.garantiaPct.replace(".", ",")}% do contrato)`, null, null, null, null, n(k.garantiaTotal)] },
      ],
    });
  }
  return responderPlanilha(wb, `contrato-${k.numero}.xlsx`);
}
