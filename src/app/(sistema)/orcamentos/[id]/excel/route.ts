import ExcelJS from "exceljs";
import { ErroDeRegra } from "@/lib/db";
import { comoAtor, usuarioAtual } from "@/lib/sessao";
import { PARCELAS_BDI, ROTULO_PARCELA } from "@/servicos/calculo";
import { cronogramaDo, curvaAbcInsumos, curvaAbcServicos, insumosDoOrcamento, obterOrcamento, rotuloOrcamento } from "@/servicos/orcamentos";
import { ROTULO_FONTE, ROTULO_REGIME, ROTULO_TIPO_INSUMO } from "@/servicos/precos";
import { SemPermissao } from "@/servicos/permissoes";

const n = (v: string | null | undefined) => (v == null ? null : Number(v));
const MOEDA = '"R$" #,##0.00';
const PCT = '0.00"%"';

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

  const wb = new ExcelJS.Workbook();
  wb.creator = "CiviObras";
  wb.created = new Date();
  const cab = (ws: ExcelJS.Worksheet, linha: number) => {
    const r = ws.getRow(linha);
    r.font = { bold: true, color: { argb: "FFFFFFFF" } };
    r.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F4C5C" } }; });
  };

  // Resumo
  const r = wb.addWorksheet("Resumo");
  r.columns = [{ width: 34 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }];
  r.addRow([u.orgaoNome]).font = { bold: true, size: 13 };
  r.addRow([`Orçamento ${rotuloOrcamento(o)} · ${o.nome}`]).font = { bold: true };
  r.addRow([`${o.obraCodigo} · ${o.obraNome}`]);
  r.addRow([`Data-base: ${ROTULO_FONTE[o.fonte]} ${o.uf} ${o.mes} · ${ROTULO_REGIME[o.regime]} · ${o.arredondamento === "truncar" ? "Truncado" : "Arredondado"} em 2 casas`]);
  if (o.nota) r.addRow([`Nota nº ${String(o.nota.numero).padStart(4, "0")}/${o.nota.ano}`]);
  r.addRow([]);
  r.addRow(["Etapa", "Material", "Mão de obra", "Equipamento", "Custo direto", "BDI", "Total"]);
  cab(r, r.rowCount);
  for (const e of o.etapas) r.addRow([`${e.ordem}. ${e.nome}`, n(e.totais.material), n(e.totais.maoDeObra), n(e.totais.equipamento), n(e.totais.custo), n(e.totais.bdi), n(e.totais.total)]);
  const tot = r.addRow(["Total", n(o.totais.material), n(o.totais.maoDeObra), n(o.totais.equipamento), n(o.totais.custo), n(o.totais.bdi), n(o.totais.total)]);
  tot.font = { bold: true };
  for (let c = 2; c <= 7; c++) r.getColumn(c).numFmt = MOEDA;
  r.addRow([]);
  r.addRow(["BDI", "Obra", "Fornecimento"]);
  cab(r, r.rowCount);
  for (const p of PARCELAS_BDI) r.addRow([ROTULO_PARCELA[p], n(o.bdiObra[p]), n(o.bdiFornecimento[p])]).eachCell((c, i) => { if (i > 1) c.numFmt = PCT; });
  r.addRow(["BDI calculado", n(o.bdiObraPct), n(o.bdiFornecimentoPct)]).eachCell((c, i) => { c.font = { bold: true }; if (i > 1) c.numFmt = PCT; });
  r.addRow([]);
  r.addRow(["Responsável técnico", o.responsavelTecnico ?? ""]);
  r.addRow(["Registro profissional", o.registroProfissional ?? ""]);
  r.addRow(["ART/RRT", o.art ?? ""]);

  // Planilha
  const p = wb.addWorksheet("Planilha", { views: [{ state: "frozen", ySplit: 1 }] });
  p.columns = [
    { header: "Item", width: 9 }, { header: "Fonte", width: 13 }, { header: "Código", width: 12 }, { header: "Descrição", width: 60 },
    { header: "Und.", width: 7 }, { header: "Quant.", width: 12 }, { header: "Custo unit.", width: 14 }, { header: "BDI", width: 12 },
    { header: "Preço unit.", width: 14 }, { header: "Total", width: 16 }, { header: "Memória de cálculo", width: 50 },
  ];
  cab(p, 1);
  for (const e of o.etapas) {
    const le = p.addRow([String(e.ordem), "", "", e.nome, "", null, null, null, null, n(e.totais.total)]);
    le.font = { bold: true };
    for (const i of e.itens) {
      p.addRow([i.numero, ROTULO_FONTE[i.fonte], i.codigo ?? "", i.descricao, i.unidade, n(i.quantidade), i.semPreco ? null : n(i.custoUnitario),
        i.tipoBdi === "fornecimento" ? "Fornecimento" : "Obra", i.semPreco ? null : n(i.precoUnitario), i.semPreco ? null : n(i.total), i.memoria ?? ""]);
    }
  }
  p.addRow(["", "", "", "Total", "", null, null, null, null, n(o.totais.total)]).font = { bold: true };
  p.getColumn(6).numFmt = "#,##0.000";
  for (const c of [7, 9, 10]) p.getColumn(c).numFmt = MOEDA;

  // Analítica
  const an = wb.addWorksheet("Analítica");
  an.columns = [{ header: "Item", width: 9 }, { header: "Código", width: 12 }, { header: "Descrição", width: 60 }, { header: "Tipo", width: 14 },
    { header: "Und.", width: 7 }, { header: "Coeficiente", width: 14 }, { header: "Preço", width: 14 }, { header: "Parcial", width: 14 }];
  cab(an, 1);
  for (const i of o.etapas.flatMap((e) => e.itens)) {
    const linhas = analitica.get(i.id) ?? [];
    if (!linhas.length) continue;
    an.addRow([i.numero, i.codigo ?? "", `${i.descricao} (${i.unidade})`, "", "", null, null, i.semPreco ? null : n(i.custoUnitario)]).font = { bold: true };
    for (const l of linhas) {
      const row = an.addRow(["", l.codigo, l.descricao, ROTULO_TIPO_INSUMO[l.tipo], l.unidade, n(l.coeficiente), n(l.preco), null]);
      if (l.preco != null) row.getCell(8).value = { formula: `F${row.number}*G${row.number}`, result: Number(l.coeficiente) * Number(l.preco) };
    }
  }
  an.getColumn(6).numFmt = "0.0000000";
  for (const c of [7, 8]) an.getColumn(c).numFmt = MOEDA;

  // Cronograma
  const cr = wb.addWorksheet("Cronograma");
  const rot = o.unidadePeriodo === "mes" ? "Mês" : "Semana";
  cr.columns = [{ header: "Etapa", width: 34 }, { header: "Total", width: 16 }, ...Array.from({ length: o.periodos }, (_, k) => ({ header: `${rot} ${k + 1}`, width: 15 }))];
  cab(cr, 1);
  o.etapas.forEach((e, k) => cr.addRow([`${e.ordem}. ${e.nome}`, n(e.totais.total), ...crono.linhas[k].valores.map(n)]));
  cr.addRow(["No período", n(o.totais.total), ...crono.porPeriodo.map(n)]).font = { bold: true };
  cr.addRow(["Acumulado", null, ...crono.acumulado.map(n)]);
  for (let c = 2; c <= o.periodos + 2; c++) cr.getColumn(c).numFmt = MOEDA;
  cr.addRow(["% acumulado", null, ...crono.pctAcumulado.map(n)]).eachCell((c, i) => { if (i > 2) c.numFmt = PCT; });

  // Curvas ABC
  const s = wb.addWorksheet("ABC serviços");
  s.columns = [{ header: "Classe", width: 8 }, { header: "Item", width: 9 }, { header: "Código", width: 12 }, { header: "Descrição", width: 60 },
    { header: "Total", width: 16 }, { header: "%", width: 10 }, { header: "Acumulado", width: 12 }];
  cab(s, 1);
  for (const l of abcS.linhas) s.addRow([l.classe, l.numero, l.codigo ?? "", l.descricao, n(l.valor), n(l.percentual), n(l.acumulado)]);
  s.getColumn(5).numFmt = MOEDA; s.getColumn(6).numFmt = PCT; s.getColumn(7).numFmt = PCT;

  const ins = wb.addWorksheet("ABC insumos");
  ins.columns = [{ header: "Classe", width: 8 }, { header: "Código", width: 12 }, { header: "Insumo", width: 60 }, { header: "Tipo", width: 14 }, { header: "Und.", width: 7 },
    { header: "Quantidade", width: 14 }, { header: "Preço", width: 14 }, { header: "Custo", width: 16 }, { header: "%", width: 10 }, { header: "Acumulado", width: 12 }];
  cab(ins, 1);
  for (const l of abcI.linhas) ins.addRow([l.classe, l.codigo, l.descricao, ROTULO_TIPO_INSUMO[l.tipo], l.unidade, n(l.quantidade), n(l.preco), n(l.valor), n(l.percentual), n(l.acumulado)]);
  ins.getColumn(6).numFmt = "#,##0.0000"; ins.getColumn(7).numFmt = MOEDA; ins.getColumn(8).numFmt = MOEDA; ins.getColumn(9).numFmt = PCT; ins.getColumn(10).numFmt = PCT;

  const buffer = await wb.xlsx.writeBuffer();
  const nome = `orcamento-${o.obraCodigo}-${rotuloOrcamento(o).replace(" ", "-")}.xlsx`.replace(/[^\w.-]/g, "_");
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nome}"`,
      "Cache-Control": "no-store",
    },
  });
}
