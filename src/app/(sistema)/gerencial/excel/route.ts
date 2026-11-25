import { abaTabela, capa, FORMATO, novaPasta, responderPlanilha, type Linha } from "@/lib/excel-modelo";
import { dataCurta } from "@/lib/formato";
import { comoAtor, usuarioAtual } from "@/lib/sessao";
import { painelGerencial, type Nivel } from "@/servicos/gerencial";
import { pode } from "@/servicos/permissoes";
import { ROTULO_SITUACAO } from "@/servicos/rotulos";
import { descreverFiltros, lerFiltros, rotuloMes } from "../filtros";

const ROTULO_NIVEL: Record<Nivel, string> = { vermelho: "Crítica", amarelo: "Atenção", verde: "Em dia" };

export async function GET(req: Request) {
  const u = await usuarioAtual();
  if (!u) return new Response("Sessão encerrada.", { status: 401 });
  const ator = comoAtor(u);
  if (!pode(ator, "gerencial.ver")) return new Response("Sem acesso.", { status: 404 });
  const q = new URL(req.url).searchParams;
  const filtros = lerFiltros({ tipo: q.get("tipo"), unidade: q.get("unidade"), situacao: q.get("situacao") });
  const p = await painelGerencial(ator, filtros);
  const t = p.totais;
  const doc = { orgao: u.orgaoNome, titulo: "Painel gerencial · carteira de obras", subtitulo: descreverFiltros(filtros, p.unidades), geradoEm: new Date(), geradoPor: u.nome };
  const wb = novaPasta(doc);
  await capa(wb, doc, [
    ["Recorte", descreverFiltros(filtros, p.unidades)],
    ["Obras", `${p.obras.length} (${p.porNivel.vermelho} críticas, ${p.porNivel.amarelo} em atenção, ${p.porNivel.verde} em dia)`],
  ], [["Contratado (R$)", t.contratado, FORMATO.moeda], ["Medido (R$)", t.medido, FORMATO.moeda], ["Pago (R$)", t.pago, FORMATO.moeda], ["A pagar (R$)", t.aPagar, FORMATO.moeda]]);
  await abaTabela(wb, doc, "Obras", {
    titulo: "Obras, semáforo e execução", paisagem: true,
    colunas: [
      { titulo: "Código", largura: 14 }, { titulo: "Obra", largura: 36 }, { titulo: "Situação", largura: 16 }, { titulo: "Unidade", largura: 12 }, { titulo: "Nível", largura: 10 },
      { titulo: "Contratado", largura: 15, formato: FORMATO.moeda }, { titulo: "Medido", largura: 15, formato: FORMATO.moeda }, { titulo: "Pago", largura: 15, formato: FORMATO.moeda },
      { titulo: "A pagar", largura: 14, formato: FORMATO.moeda }, { titulo: "% medido", largura: 9, formato: FORMATO.pct }, { titulo: "% previsto", largura: 9, formato: FORMATO.pct },
      { titulo: "% executado", largura: 10, formato: FORMATO.pct }, { titulo: "IDP", largura: 7, formato: "0.00" }, { titulo: "Vigência", largura: 11, alinhar: "center" }, { titulo: "Motivos", largura: 60 },
    ],
    linhas: [
      ...p.obras.map((o): Linha => ({ valores: [o.codigo, o.nome, ROTULO_SITUACAO[o.situacao], o.unidade ?? "", ROTULO_NIVEL[o.nivel], o.contratado, o.medido, o.pago, o.aPagar,
        o.contratado ? o.executadoPct : null, o.previstoPct, o.realizadoPct, o.idp, o.vigenciaFim ? dataCurta(o.vigenciaFim) : "", o.motivos.map((m) => m.texto).join("; ")] })),
      { tipo: "total", valores: ["", "Total", "", "", "", t.contratado, t.medido, t.pago, t.aPagar, t.contratado ? (t.medido / t.contratado) * 100 : null, null, null, null, "", ""] },
    ],
  });
  await abaTabela(wb, doc, "Mensal", {
    titulo: "Medido e pago por mês", paisagem: false,
    colunas: [{ titulo: "Mês", largura: 10, alinhar: "center" }, { titulo: "Medido", largura: 16, formato: FORMATO.moeda }, { titulo: "Pago", largura: 16, formato: FORMATO.moeda }],
    linhas: [
      ...p.mensal.map((m): Linha => ({ valores: [rotuloMes(m.mes), m.medido, m.pago] })),
      { tipo: "total", valores: ["Total", p.mensal.reduce((s, m) => s + m.medido, 0), p.mensal.reduce((s, m) => s + m.pago, 0)] },
    ],
  });
  await abaTabela(wb, doc, "Vencimentos", {
    titulo: "Agenda de vencimentos (vencidos e próximos 60 dias)", paisagem: false,
    colunas: [{ titulo: "Data", largura: 11, alinhar: "center" }, { titulo: "Tipo", largura: 22 }, { titulo: "Descrição", largura: 48 }, { titulo: "Obra", largura: 14 }, { titulo: "Situação", largura: 10 }],
    linhas: p.vencimentos.map((v): Linha => ({ valores: [dataCurta(v.data), v.tipo, v.descricao, v.obraCodigo ?? "", v.vencido ? "Vencido" : "A vencer"] })),
  });
  return responderPlanilha(wb, "painel-gerencial.xlsx");
}
