import { ErroDeRegra } from "@/lib/db";
import { abaTabela, capa, FORMATO, novaPasta, responderPlanilha, type Linha } from "@/lib/excel-modelo";
import { dataCurta, unidadeMedida } from "@/lib/formato";
import { comoAtor, usuarioAtual } from "@/lib/sessao";
import { obterAditivo, ROTULO_SITUACAO_ADITIVO, rotuloAditivo } from "@/servicos/aditivos";
import { formatarCnpj, rotuloContrato } from "@/servicos/contratos";
import { SemPermissao } from "@/servicos/permissoes";

const n = (v: string | number | null | undefined) => (v == null ? null : Number(v));

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await usuarioAtual();
  if (!u) return new Response("Sessão encerrada.", { status: 401 });
  let d;
  try {
    d = await obterAditivo(comoAtor(u), id);
  } catch (e) {
    if (e instanceof ErroDeRegra || e instanceof SemPermissao) return new Response(e.message, { status: 404 });
    throw e;
  }
  const k = d.contrato;
  const rotuloK = rotuloContrato(k);
  const doc = {
    orgao: u.orgaoNome, titulo: `${rotuloAditivo(d)} · ${rotuloK}`,
    subtitulo: `${k.obraCodigo} · ${k.obraNome} · ${ROTULO_SITUACAO_ADITIVO[d.situacao]}`, geradoEm: new Date(), geradoPor: u.nome,
  };
  const wb = novaPasta(doc);
  await capa(wb, doc, [
    ["Obra", `${k.obraCodigo} · ${k.obraNome}`],
    ["Contrato", `${rotuloK}${k.processo ? ` · processo ${k.processo}` : ""}`],
    ["Contratada", k.empresaNome ? `${k.empresaNome} · CNPJ ${formatarCnpj(k.empresaCnpj!)}` : "Equipe própria"],
    ["Objeto do aditivo", d.objeto],
    ["Fundamento legal", d.fundamento ?? ""],
    ["Justificativa", d.justificativa],
    ["Prazo de execução", d.prazoNovo != null ? `${d.prazoAnterior} → ${d.prazoNovo} dias corridos${d.fimExecucaoNovo ? `, até ${dataCurta(d.fimExecucaoNovo)}` : ""}` : ""],
    ["Vigência", `${dataCurta(d.vigenciaAnterior)}${d.novaVigencia ? ` → ${dataCurta(d.novaVigencia)}` : " (sem alteração)"}`],
    ["Assinatura", d.dataAssinatura ? dataCurta(d.dataAssinatura) : ROTULO_SITUACAO_ADITIVO[d.situacao]],
  ], [
    ["Acréscimos", Number(d.acrescimo)],
    ["Supressões", Number(d.supressao)],
    ["Valor do contrato após o aditivo", Number(d.valorNovo)],
    ["Acréscimos acumulados", d.acrescimoAcumuladoPct, FORMATO.pct],
    ["Supressões acumuladas", d.supressaoAcumuladoPct, FORMATO.pct],
  ]);

  const alterados = d.etapas.map((e) => ({ ...e, linhas: e.linhas.filter((l) => Number(l.variacao) !== 0) })).filter((e) => e.linhas.length);
  await abaTabela(wb, doc, "Planilha do aditivo", {
    titulo: "Planilha do aditivo", paisagem: true,
    nota: "Variação positiva acresce e negativa suprime. Valor = variação × preço unitário do contrato. Itens novos com numeração A (aditivo).",
    colunas: [
      { titulo: "Item", largura: 9, alinhar: "left" }, { titulo: "Descrição", largura: 50 }, { titulo: "Und.", largura: 7 },
      { titulo: "Preço unitário", largura: 14, formato: FORMATO.moeda }, { titulo: "Quant. atual", largura: 13, formato: FORMATO.quantidade },
      { titulo: "Variação", largura: 12, formato: FORMATO.quantidade }, { titulo: "Nova quant.", largura: 13, formato: FORMATO.quantidade },
      { titulo: "Valor da variação", largura: 16, formato: FORMATO.moeda }, { titulo: "Novo total", largura: 16, formato: FORMATO.moeda },
    ],
    linhas: [
      ...alterados.flatMap((e): Linha[] => [
        { tipo: "grupo", valores: [e.nome, null, null, null, null, null, null, n(e.valorVariacao), null] },
        ...e.linhas.map((l): Linha => ({ valores: [
          l.numero, l.novo ? `${l.descricao} (novo)` : l.descricao, unidadeMedida(l.unidade), n(l.precoUnitario), n(l.anterior), n(l.variacao), n(l.nova), n(l.valorVariacao), n(l.valorNovo),
        ] })),
      ]),
      { tipo: "total", valores: ["Acréscimos", null, null, null, null, null, null, n(d.acrescimo), null] },
      { tipo: "total", valores: ["Supressões", null, null, null, null, null, null, -Number(d.supressao), null] },
      { tipo: "total", valores: ["Valor do contrato após o aditivo", null, null, null, null, null, null, n(d.liquido), n(d.valorNovo)] },
    ],
  });

  await abaTabela(wb, doc, "Limites", {
    titulo: "Limites da Lei 14.133/2021, art. 125", paisagem: false,
    nota: "Acréscimos e supressões somados separadamente, sem compensação, sobre o valor inicial atualizado pelos reajustes.",
    colunas: [{ titulo: "Referência", largura: 50 }, { titulo: "Valor", largura: 18, formato: FORMATO.moeda }, { titulo: "% do valor inicial atualizado", largura: 18, formato: FORMATO.pct }],
    linhas: [
      { valores: ["Valor inicial atualizado", n(d.base), 100] },
      { valores: ["Acréscimos de aditivos anteriores", n(d.acrescimoAnterior), null] },
      { valores: ["Acréscimos deste aditivo", n(d.acrescimo), d.acrescimoPct] },
      { tipo: "grupo", valores: ["Acréscimos acumulados", n(d.acrescimoAcumulado), d.acrescimoAcumuladoPct] },
      { valores: [`Limite de acréscimo (${d.limiteAcrescimoPct}%)`, n(d.limiteAcrescimo), d.limiteAcrescimoPct] },
      { valores: ["Supressões de aditivos anteriores", n(d.supressaoAnterior), null] },
      { valores: ["Supressões deste aditivo", n(d.supressao), d.supressaoPct] },
      { tipo: "grupo", valores: ["Supressões acumuladas", n(d.supressaoAcumulado), d.supressaoAcumuladoPct] },
      { valores: ["Limite de supressão (25%)", n(d.limiteSupressao), 25] },
    ],
  });
  return responderPlanilha(wb, `aditivo-${String(d.numero).padStart(2, "0")}-contrato-${k.numero.replace(/[^\w-]+/g, "-")}.xlsx`);
}
