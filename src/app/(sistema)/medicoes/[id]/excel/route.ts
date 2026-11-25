import { ErroDeRegra } from "@/lib/db";
import { abaTabela, capa, FORMATO, novaPasta, responderPlanilha, type Linha } from "@/lib/excel-modelo";
import { dataCurta } from "@/lib/formato";
import { comoAtor, usuarioAtual } from "@/lib/sessao";
import { formatarCnpj, rotuloContrato } from "@/servicos/contratos";
import { obterMedicao, ROTULO_PAGAMENTO, ROTULO_RETENCAO, ROTULO_SITUACAO_MEDICAO, ROTULO_TRAMITE, rotuloMedicao } from "@/servicos/medicoes";
import { SemPermissao } from "@/servicos/permissoes";

const n = (v: string | number | null | undefined) => (v == null ? null : Number(v));

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await usuarioAtual();
  if (!u) return new Response("Sessão encerrada.", { status: 401 });
  let m;
  try {
    m = await obterMedicao(comoAtor(u), id);
  } catch (e) {
    if (e instanceof ErroDeRegra || e instanceof SemPermissao) return new Response(e.message, { status: 404 });
    throw e;
  }
  const rotuloK = rotuloContrato({ numero: m.contratoNumero, regime: m.regime });
  const direta = m.regime === "direta";
  const doc = {
    orgao: u.orgaoNome, titulo: `${rotuloMedicao(m)} · ${rotuloK}`,
    subtitulo: `${m.obraCodigo} · ${m.obraNome} · ${ROTULO_SITUACAO_MEDICAO[m.situacao]}`, geradoEm: new Date(), geradoPor: u.nome,
  };
  const wb = novaPasta(doc);
  await capa(wb, doc, [
    ["Obra", `${m.obraCodigo} · ${m.obraNome}`],
    ["Contrato", `${rotuloK}${m.processo ? ` · processo ${m.processo}` : ""}`],
    ["Contratada", m.empresaNome ? `${m.empresaNome} · CNPJ ${formatarCnpj(m.empresaCnpj!)}` : "Equipe própria"],
    ["Objeto", m.objeto],
    ["Período", `${dataCurta(m.periodoInicio)} a ${dataCurta(m.periodoFim)}`],
    ["Situação", `${ROTULO_SITUACAO_MEDICAO[m.situacao]}${m.situacaoPagamento ? ` · ${ROTULO_PAGAMENTO[m.situacaoPagamento]}` : ""}`],
    ["Fiscal", m.atestadaPorNome ?? m.fiscalNome ?? ""],
    ["Gestor do contrato", m.aprovadaPorNome ?? m.gestorNome ?? ""],
    ...(m.ajuste ? [["Motivo do ajuste", m.observacao ?? ""] as [string, string]] : []),
  ], [
    ["Valor medido", Number(m.bruto)],
    ...(Number(m.reajuste) !== 0 ? [["Reajuste", Number(m.reajuste)] as [string, number]] : []),
    ["Glosas", Number(m.glosa)],
    ["Retenções", Number(m.retencao)],
    [direta ? "Valor apropriado" : "Líquido a pagar", Number(m.liquido)],
    ["Acumulado no contrato", m.acumuladoPct, FORMATO.pct],
  ]);

  await abaTabela(wb, doc, "Boletim", {
    titulo: "Planilha de medição", paisagem: true,
    nota: "Valor = quantidade medida × preço unitário contratual. Linhas sem quantidade nesta medição mostram o acumulado do item.",
    colunas: [
      { titulo: "Item", largura: 8, alinhar: "left" }, { titulo: "Descrição", largura: 50 }, { titulo: "Und.", largura: 7 },
      { titulo: "Contratado", largura: 12, formato: FORMATO.quantidade }, { titulo: "Anterior", largura: 12, formato: FORMATO.quantidade },
      { titulo: "Nesta medição", largura: 13, formato: FORMATO.quantidade }, { titulo: "Acumulado", largura: 12, formato: FORMATO.quantidade },
      { titulo: "Saldo", largura: 12, formato: FORMATO.quantidade }, { titulo: "Preço unitário", largura: 14, formato: FORMATO.moeda },
      { titulo: "Valor nesta medição", largura: 16, formato: FORMATO.moeda }, { titulo: "Memória de cálculo", largura: 36 },
    ],
    linhas: [
      ...m.etapas.flatMap((e): Linha[] => [
        { tipo: "grupo", valores: [e.nome, null, null, null, null, null, null, null, null, n(e.valorNesta), null] },
        ...e.linhas.map((l): Linha => ({ valores: [
          l.numero, l.descricao, l.unidade, n(l.contratado), n(l.anterior), Number(l.nesta) ? n(l.nesta) : null, n(l.acumulado), n(l.saldo),
          n(l.precoUnitario), Number(l.nesta) ? n(l.valorNesta) : null, l.memoria ?? "",
        ] })),
      ]),
      { tipo: "total", valores: ["Valor medido", null, null, null, null, null, null, null, null, n(m.bruto), null] },
    ],
  });

  await abaTabela(wb, doc, "Demonstrativo", {
    titulo: direta ? "Demonstrativo do valor" : "Demonstrativo do valor a pagar", paisagem: false,
    colunas: [{ titulo: "Lançamento", largura: 60 }, { titulo: "Valor", largura: 18, formato: FORMATO.moeda }],
    linhas: [
      { valores: ["Valor medido a preços do contrato", n(m.bruto)] },
      ...(n(m.reajuste) !== 0 ? [{ valores: [`(+) Reajuste de ${String(m.reajustePctAplicado).replace(".", ",")}%`, n(m.reajuste)] } as Linha] : []),
      ...m.glosas.map((g): Linha => ({ valores: [`(−) Glosa: ${g.motivo}${g.itemNumero ? ` (item ${g.itemNumero})` : ""}`, -Number(g.valor)] })),
      { tipo: "grupo", valores: ["Valor da nota fiscal", n(m.valorNota)] },
      ...m.retencoes.map((r): Linha => ({ valores: [`(−) ${ROTULO_RETENCAO[r.tipo]}${r.descricao ? ` · ${r.descricao}` : ""}: ${r.aliquota.replace(".", ",")}% sobre R$ ${Number(r.base).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, -Number(r.valor)] })),
      { tipo: "total", valores: [direta ? "Valor apropriado" : "Líquido a pagar", n(m.liquido)] },
      ...m.pagamentos.map((p): Linha => ({ valores: [`Pago em ${dataCurta(p.data)} · empenho ${p.empenho ?? ""}${p.ordemBancaria ? ` · ${p.ordemBancaria}` : ""}`, n(p.valor)] })),
      ...(m.situacao === "aprovada" && !direta ? [{ tipo: "total", valores: ["Falta pagar", n(m.aPagar)] } as Linha] : []),
    ],
  });

  await abaTabela(wb, doc, "Tramitação", {
    titulo: "Tramitação da medição", paisagem: false,
    colunas: [{ titulo: "Etapa", largura: 26 }, { titulo: "Responsável", largura: 26 }, { titulo: "Data e hora", largura: 18 }, { titulo: "Observação", largura: 50 }],
    linhas: m.tramites.map((t): Linha => ({ valores: [
      ROTULO_TRAMITE[t.acao] ?? t.acao, t.por ?? "",
      new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(t.em)), t.observacao ?? "",
    ] })),
  });
  return responderPlanilha(wb, `medicao-${String(m.numero).padStart(2, "0")}-contrato-${m.contratoNumero.replace(/[^\w-]+/g, "-")}.xlsx`);
}
