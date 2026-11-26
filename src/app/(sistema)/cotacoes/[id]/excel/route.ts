import { ErroDeRegra } from "@/lib/db";
import { abaTabela, capa, FORMATO, novaPasta, responderPlanilha, type Coluna, type Linha } from "@/lib/excel-modelo";
import { comoAtor, usuarioAtual } from "@/lib/sessao";
import { formatarCnpj } from "@/servicos/contratos";
import { FATORES, mediaMediana, ROTULO_CRITERIO_APURACAO, ROTULO_FATOR } from "@/servicos/cotacao-calculo";
import { obterSolicitacao, protocolo, ROTULO_CONVITE, ROTULO_SITUACAO_COTACAO } from "@/servicos/cotacoes";
import { SemPermissao } from "@/servicos/permissoes";
import { ROTULO_FONTE, ROTULO_REGIME, type Fonte, type Regime } from "@/servicos/precos";
import { unidade } from "@/lib/unidade";

const n = (v: string | null | undefined) => (v == null ? null : Number(v));
const FUSO = "America/Sao_Paulo";
const quando = (d: Date | string | null | undefined) =>
  d ? new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(d)) : "";
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const mesAno = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]}/${m.slice(0, 4)}`;
/** Letra da coluna do Excel a partir do número (1 = A). */
function col(i: number) {
  let s = "";
  for (; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  return s;
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await usuarioAtual();
  if (!u) return new Response("Sessão encerrada.", { status: 401 });
  const a = comoAtor(u);
  let s;
  try {
    s = await obterSolicitacao(a, id);
  } catch (e) {
    if (e instanceof ErroDeRegra || e instanceof SemPermissao) return new Response(e.message, { status: 404 });
    throw e;
  }
  const m = s.precosVisiveis ? s.mapa : null;
  const ap = s.situacao === "apurada" ? s.apuracoes[0] ?? null : null;
  const r = ap?.resultado ?? null;
  const numero = String(s.numero).padStart(3, "0");
  const doc = {
    orgao: u.orgaoNome, titulo: `Cotação de materiais nº ${numero}`,
    subtitulo: `${s.titulo} · ${s.obraCodigo} · ${s.obraNome}`, geradoEm: new Date(), geradoPor: u.nome,
  };
  const wb = novaPasta(doc);

  await capa(wb, doc, [
    ["Obra", `${s.obraCodigo} · ${s.obraNome}`],
    ["Orçamento", `Nº ${s.orcamentoNumero} v${s.orcamentoVersao} · ${s.orcamentoNome}`],
    ["Situação", ROTULO_SITUACAO_COTACAO[s.situacao]],
    ["Referência de preços", `${ROTULO_FONTE[s.fonte as Fonte] ?? s.fonte} ${s.uf} ${mesAno(s.mes)} · ${ROTULO_REGIME[s.regime as Regime] ?? s.regime}`],
    ["Critério", ROTULO_CRITERIO_APURACAO[s.criterio]],
    ["Prazo de resposta", quando(s.prazo)],
    ["Fornecedores", `${s.convites.length} convidados · ${s.respondidas} propostas · ${s.declinaram} declinaram`],
    ["Homologação", ap ? `${quando(ap.homologadaEm)} · ${ap.homologadaPor ?? ""}` : "Pendente"],
    ...(s.comparacao ? [
      ["Menor preço por item", s.comparacao.porItem ? `R$ ${Number(s.comparacao.porItem.total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} · ${s.comparacao.porItem.fornecedores.map((f) => `${f.fornecedor} (${f.itens})`).join(", ")}` : "Sem preço válido"],
      ["Menor preço global", s.comparacao.global ? `${s.comparacao.global.fornecedor} · R$ ${Number(s.comparacao.global.total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "Nenhum fornecedor cotou todos os itens"],
      ["Melhor custo-benefício", s.comparacao.custoBeneficio ? `${s.comparacao.custoBeneficio.fornecedor} · nota ${String(s.comparacao.custoBeneficio.nota ?? "").replace(".", ",")}` : "Nenhum fornecedor cotou todos os itens"],
    ] as [string, string][] : []),
    ...(m ? [] : [["Preços", "Propostas fechadas até o encerramento do prazo."] as [string, string]]),
    ...(s.fonte === "demonstracao" ? [["Atenção", "Preços de referência da base de demonstração, ilustrativos."] as [string, string]] : []),
  ], [
    ["Referência do orçamento", Number(s.totalReferencia)],
    ...(r ? [["Resultado homologado", Number(r.totalResultado)] as [string, number]] : m ? [["Soma dos menores preços", Number(m.somaMenores)] as [string, number]] : []),
    ...(r?.economia != null ? [["Economia homologada", Number(r.economia)] as [string, number]] : m?.itensCotados ? [["Economia possível", Number(m.economiaPorItem)] as [string, number]] : []),
    ["Materiais", s.materiais.length, "0"],
  ]);

  // Materiais: total de referência por fórmula.
  await abaTabela(wb, doc, "Materiais", {
    titulo: "Materiais solicitados", paisagem: true, nota: "Quantidades e preços de referência fixados no envio da solicitação.",
    colunas: [{ titulo: "Item", largura: 7, alinhar: "center" }, { titulo: "Código", largura: 12 }, { titulo: "Descrição", largura: 60 }, { titulo: "Und.", largura: 7, alinhar: "center" },
      { titulo: "Quantidade", largura: 13, formato: "#,##0.0000" }, { titulo: "Preço de referência", largura: 17, formato: FORMATO.moeda }, { titulo: "Total de referência", largura: 18, formato: FORMATO.moeda }],
    linhas: [
      ...s.materiais.map((x, i): Linha => {
        const l = 6 + i;
        const total = x.precoReferencia == null ? null : Number(x.quantidade) * Number(x.precoReferencia);
        return { valores: [i + 1, x.semSinapi ? "" : x.codigo, x.descricao, unidade(x.unidade), n(x.quantidade), n(x.precoReferencia), total == null ? null : { formula: `ROUND(E${l}*F${l},2)`, result: Math.round(total * 100) / 100 }] };
      }),
      { tipo: "total", valores: ["", "", "Total de referência", "", null, null, { formula: `SUM(G6:G${5 + s.materiais.length})`, result: Number(s.totalReferencia) }] },
    ],
  });

  await abaTabela(wb, doc, "Fornecedores", {
    titulo: "Fornecedores consultados", paisagem: true,
    colunas: [{ titulo: "Fornecedor", largura: 38 }, { titulo: "CNPJ", largura: 20 }, { titulo: "Contato", largura: 22 }, { titulo: "E-mail", largura: 28 }, { titulo: "Situação", largura: 16 },
      { titulo: "Convite enviado", largura: 17 }, { titulo: "Abriu o link", largura: 17 }, { titulo: "Proposta recebida", largura: 17 }, { titulo: "Versão", largura: 8, alinhar: "center" },
      { titulo: "Itens cotados", largura: 12, formato: "0" }, { titulo: "Total", largura: 16, formato: FORMATO.moeda }, { titulo: "Observação", largura: 36 }],
    linhas: s.convites.map((c): Linha => ({ valores: [c.razaoSocial, formatarCnpj(c.cnpj), c.contato ?? "", c.email ?? "", ROTULO_CONVITE[c.situacao], quando(c.enviadoEm), quando(c.abertoEm), quando(c.respostaEm),
      c.versao ?? "", c.cotados, n(m?.fornecedores.find((f) => f.conviteId === c.id)?.total), c.declinouMotivo ?? c.motivo ?? ""] })),
  });

  if (m && s.propostas.length) {
    await abaTabela(wb, doc, "Propostas", {
      titulo: "Propostas recebidas", paisagem: true, nota: "Última versão de cada fornecedor recebida dentro do prazo.",
      colunas: [{ titulo: "Fornecedor", largura: 34 }, { titulo: "Código", largura: 12 }, { titulo: "Material", largura: 50 }, { titulo: "Und.", largura: 7, alinhar: "center" },
        { titulo: "Quantidade", largura: 13, formato: "#,##0.0000" }, { titulo: "Preço unitário", largura: 15, formato: '"R$" #,##0.0000' }, { titulo: "Total", largura: 16, formato: FORMATO.moeda },
        { titulo: "Marca", largura: 20 }, { titulo: "Modelo", largura: 18 }, { titulo: "Situação", largura: 22 }, { titulo: "Observação", largura: 34 }],
      linhas: s.propostas.flatMap((p): Linha[] => [
        { tipo: "grupo", valores: [`${p.fornecedor} · v${p.versao} · ${quando(p.enviadaEm)} · protocolo ${protocolo(p.resumo, p.versao)}`, "", `Responsável: ${p.responsavelNome}${p.origem === "equipe" ? ` · lançada pela equipe (${p.documento ?? ""})` : ""}`, "", null, null,
          n(m.fornecedores.find((f) => f.conviteId === p.conviteId)?.total), "", "", [p.prazoEntrega != null ? `entrega ${p.prazoEntrega} d` : "", p.pagamentoDias != null ? `pagamento ${p.pagamentoDias} d` : "", p.garantiaMeses != null ? `garantia ${p.garantiaMeses} m` : ""].filter(Boolean).join(" · "), p.observacao ?? ""] },
        ...m.linhas.map((l): Linha => {
          const o = l.ofertas.find((x) => x.conviteId === p.conviteId);
          return { valores: [p.fornecedor, l.material.semSinapi ? "" : l.material.codigo, l.material.descricao, unidade(l.material.unidade), n(l.material.quantidade), n(o?.preco), n(o?.total), o?.marca ?? "", o?.modelo ?? "",
            !o || o.preco == null ? "Indisponível" : o.excluida === "nao_atende" ? "Não atende à especificação" : o.excluida ? "Desconsiderado" : o.menor ? "Menor preço do item" : "", o?.justificativa ?? o?.observacao ?? ""] };
        }),
      ]),
    });

    // Comparativo: totais, menor preço e diferença por fórmula.
    const fs = m.fornecedores;
    const pri = 6, ult = 5 + m.linhas.length, c0 = 7; // primeira coluna de fornecedor = G
    const cMedia = c0 + fs.length, cMenor = cMedia + 2;
    const colunas: Coluna[] = [{ titulo: "Item", largura: 7, alinhar: "center" }, { titulo: "Código", largura: 12 }, { titulo: "Material", largura: 50 }, { titulo: "Und.", largura: 7, alinhar: "center" },
      { titulo: "Quantidade", largura: 13, formato: "#,##0.0000" }, { titulo: "Referência", largura: 14, formato: FORMATO.moeda },
      ...fs.map((f): Coluna => ({ titulo: f.fornecedor, largura: 18, formato: '"R$" #,##0.0000' })),
      { titulo: "Média", largura: 14, formato: '"R$" #,##0.0000' }, { titulo: "Mediana", largura: 14, formato: '"R$" #,##0.0000' },
      { titulo: "Menor preço", largura: 15, formato: '"R$" #,##0.0000' }, { titulo: "Diferença sobre a referência", largura: 15, formato: '0.0%' }, { titulo: "Fornecedor do menor preço", largura: 34 }];
    const est = m.linhas.map((l) => ({ q: l.material.quantidade, ...mediaMediana(l) }));
    const faixaF = (l: number) => `${col(c0)}${l}:${col(c0 + fs.length - 1)}${l}`;
    await abaTabela(wb, doc, "Comparativo", {
      titulo: "Mapa comparativo de preços unitários", paisagem: true,
      nota: "Referência, preços lado a lado, média e mediana dos preços válidos. Preços retirados da disputa por avaliação técnica não entram nesta aba. Total por fornecedor = soma de quantidade × preço dos itens cotados.",
      colunas,
      linhas: [
        ...m.linhas.map((l, i): Linha => {
          const L = pri + i;
          return { valores: [i + 1, l.material.semSinapi ? "" : l.material.codigo, l.material.descricao, unidade(l.material.unidade), n(l.material.quantidade), n(l.material.precoReferencia),
            ...fs.map((f) => { const o = l.ofertas.find((x) => x.conviteId === f.conviteId); return o && o.preco != null && !o.excluida ? Number(o.preco) : null; }),
            est[i].media == null ? null : { formula: `AVERAGE(${faixaF(L)})`, result: est[i].media! },
            est[i].mediana == null ? null : { formula: `MEDIAN(${faixaF(L)})`, result: est[i].mediana! },
            l.menor ? { formula: `MIN(${faixaF(L)})`, result: Number(l.menor.preco) } : null,
            l.menor && l.material.precoReferencia != null && !l.material.semSinapi ? { formula: `IF(F${L}>0,${col(cMenor)}${L}/F${L}-1,"")`, result: Number(l.menor.preco) / Number(l.material.precoReferencia) - 1 } : null,
            l.menor ? fs.find((f) => f.conviteId === l.menor!.conviteId)?.fornecedor ?? "" : "Sem proposta válida"] };
        }),
        { tipo: "total", valores: ["", "", "Total dos itens cotados", "", null, { formula: `SUMPRODUCT(ROUND(E${pri}:E${ult}*F${pri}:F${ult},2))`, result: Number(m.totalReferencia) },
          ...fs.map((f, k) => ({ formula: `SUMPRODUCT(ROUND(E${pri}:E${ult}*${col(c0 + k)}${pri}:${col(c0 + k)}${ult},2))`, result: Number(f.total) })),
          ...[0, 1].map((k) => ({ formula: `SUMPRODUCT(ROUND(E${pri}:E${ult}*${col(cMedia + k)}${pri}:${col(cMedia + k)}${ult},2))`, result: est.reduce((t, e) => { const v = k ? e.mediana : e.media; return t + (v == null ? 0 : Math.round(Number(e.q) * v * 100) / 100); }, 0) })),
          { formula: `SUMPRODUCT(ROUND(E${pri}:E${ult}*${col(cMenor)}${pri}:${col(cMenor)}${ult},2))`, result: Number(m.somaMenores) }, null, ""] },
        { valores: ["", "", "Itens cotados", "", null, null, ...fs.map((_, k) => ({ formula: `COUNT(${col(c0 + k)}${pri}:${col(c0 + k)}${ult})`, result: fs[k].itensCotados })), null, null, null, null, ""] },
      ],
    });
  }

  if (m && s.comparacao?.classificacao.length) {
    const c = s.comparacao;
    const fat = FATORES.filter((k) => c.pesos[k] > 0);
    await abaTabela(wb, doc, "Custo-benefício", {
      titulo: "Comparação automática de custo-benefício", paisagem: true,
      nota: `Nota de 0 a 100 por fator, ponderada pelos pesos ${c.pesosDaSolicitacao ? "fixados no envio da solicitação" : "padrão do sistema"}, entre as propostas que cotaram todos os itens. A marca não pontua.`,
      colunas: [{ titulo: "Posição", largura: 9, alinhar: "center" }, { titulo: "Fornecedor", largura: 40 }, { titulo: "Total", largura: 17, formato: FORMATO.moeda },
        ...fat.map((k) => ({ titulo: `${ROTULO_FATOR[k]} (peso ${c.pesos[k]})`, largura: 18, formato: "0.00" })), { titulo: "Nota final", largura: 12, formato: "0.00" },
        { titulo: "Entrega (dias)", largura: 12, formato: "0" }, { titulo: "Pagamento (dias)", largura: 13, formato: "0" }, { titulo: "Garantia (meses)", largura: 13, formato: "0" }],
      linhas: c.classificacao.map((x): Linha => ({ valores: [x.posicao, x.fornecedor, n(x.total), ...fat.map((k) => x.notas?.[k] ?? null), x.nota, x.prazoEntrega, x.pagamentoDias, x.garantiaMeses] })),
    });
  }

  if (r && ap) {
    const cb = r.criterio === "custo_beneficio";
    await abaTabela(wb, doc, "Apuração", {
      titulo: `Apuração nº ${ap.numero} · ${ROTULO_CRITERIO_APURACAO[r.criterio]}`, paisagem: true,
      nota: `Desempate: ${r.desempate}${ap.justificativa ? ` Justificativa da homologação: ${ap.justificativa}` : ""}`,
      colunas: [{ titulo: "Posição", largura: 9, alinhar: "center" }, { titulo: "Fornecedor", largura: 40 }, { titulo: "Itens cotados", largura: 12, formato: "0" }, { titulo: "Itens vencidos", largura: 12, formato: "0" },
        { titulo: "Total da proposta", largura: 17, formato: FORMATO.moeda }, { titulo: "Valor vencido", largura: 17, formato: FORMATO.moeda }, { titulo: "Nota final", largura: 11, formato: "0.00" },
        { titulo: "Entrega (dias)", largura: 12, formato: "0" }, { titulo: "Pagamento (dias)", largura: 13, formato: "0" }, { titulo: "Garantia (meses)", largura: 13, formato: "0" }, { titulo: "Resultado", largura: 16 }],
      linhas: r.classificacao.map((c): Linha => ({ valores: [c.posicao, c.fornecedor, c.itensCotados, c.itensVencidos, n(c.total), n(c.valorVencido), cb ? c.nota : null, c.prazoEntrega, c.pagamentoDias, c.garantiaMeses,
        r.vencedor?.conviteId === c.conviteId ? "Vencedor" : r.criterio === "item" && c.itensVencidos > 0 ? "Vence itens" : ""] })),
    });
    const pri = 6, ult = 5 + r.itens.length;
    await abaTabela(wb, doc, "Resultado", {
      titulo: "Resultado por item", paisagem: true, nota: "Economia = total de referência − total apurado, nos itens com preço de referência.",
      colunas: [{ titulo: "Código", largura: 12 }, { titulo: "Material", largura: 50 }, { titulo: "Und.", largura: 7, alinhar: "center" }, { titulo: "Quantidade", largura: 13, formato: "#,##0.0000" },
        { titulo: "Fornecedor", largura: 34 }, { titulo: "Marca e modelo", largura: 24 }, { titulo: "Preço unitário", largura: 15, formato: '"R$" #,##0.0000' }, { titulo: "Total", largura: 16, formato: FORMATO.moeda },
        { titulo: "Referência", largura: 16, formato: FORMATO.moeda }, { titulo: "Economia", largura: 15, formato: FORMATO.moeda }],
      linhas: [
        ...r.itens.map((i, k): Linha => ({ valores: [i.codigo, i.descricao, unidade(i.unidade), n(i.quantidade), i.fornecedor ?? "Sem proposta válida", [i.marca, i.modelo].filter(Boolean).join(" · "), n(i.preco),
          i.total == null ? null : { formula: `ROUND(D${pri + k}*G${pri + k},2)`, result: Number(i.total) }, n(i.refTotal), i.economia == null ? null : { formula: `I${pri + k}-H${pri + k}`, result: Number(i.economia) }] })),
        { tipo: "total", valores: ["", "Total", "", null, "", "", null, { formula: `SUM(H${pri}:H${ult})`, result: Number(r.totalResultado) }, { formula: `SUM(I${pri}:I${ult})`, result: Number(r.totalReferencia) },
          r.economia == null ? null : { formula: `SUM(J${pri}:J${ult})`, result: Number(r.economia) }] },
      ],
    });
  }

  await abaTabela(wb, doc, "Histórico", {
    titulo: "Registro de eventos", paisagem: true,
    colunas: [{ titulo: "Data e hora", largura: 18 }, { titulo: "Evento", largura: 60 }, { titulo: "Usuário", largura: 26 }, { titulo: "Fornecedor", largura: 34 }, { titulo: "Justificativa", largura: 50 }],
    linhas: [...s.eventos].reverse().map((e): Linha => ({ valores: [quando(e.em), e.resumo, e.usuario ?? "", e.fornecedor ?? "",
      typeof e.detalhe?.justificativa === "string" ? e.detalhe.justificativa : typeof e.detalhe?.motivo === "string" ? e.detalhe.motivo : ""] })),
  });

  return responderPlanilha(wb, `cotacao-${s.obraCodigo}-${numero}.xlsx`);
}
