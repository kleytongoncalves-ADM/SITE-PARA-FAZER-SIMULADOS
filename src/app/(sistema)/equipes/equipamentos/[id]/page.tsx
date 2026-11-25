import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Save, Wrench } from "lucide-react";
import { BotaoEnviar, FormAcao } from "@/componentes/FormAcao";
import { ErroDeRegra } from "@/lib/db";
import { dataCurta, moeda, numero, paraCampo } from "@/lib/formato";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { obterEquipamento, ROTULO_MANUTENCAO } from "@/servicos/equipes";
import { SemPermissao } from "@/servicos/permissoes";
import { acaoManutencao, acaoSalvarEquipamento } from "../../acoes";
import { SituacaoEquipamento } from "../../Componentes";

export const metadata: Metadata = { title: "Equipamento" };
const hoje = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

export default async function PaginaEquipamento({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ator = comoAtor(await exigirUsuario());
  let q;
  try {
    q = await obterEquipamento(ator, id);
  } catch (e) {
    if (e instanceof ErroDeRegra || e instanceof SemPermissao) notFound();
    throw e;
  }
  const totalHoras = q.horas.reduce((s, h) => s + h.horas, 0);
  const custoManut = q.manutencoes.reduce((s, m) => s + (m.custo ?? 0), 0);

  return (
    <>
      <div className="cabecalho">
        <div><div className="sobretitulo"><Link href="/equipes">Equipes e recursos</Link></div><h1 className="titulo">{q.descricao}</h1>
          <div className="fraco" style={{ marginTop: 4 }}>{[q.identificacao, q.propriedade === "locado" ? `Locado · ${q.empresa}` : "Próprio", q.custoHora != null ? `${moeda(q.custoHora)}/h` : null].filter(Boolean).join(" · ")}</div></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <SituacaoEquipamento ativo={q.ativo} disponivel={q.disponivel} obra={q.obraAtual} />
          <Link href="/equipes" className="botao botao-neutro"><ArrowLeft /> Equipes</Link>
        </div>
      </div>

      <div className="diario-colunas">
        <section className="cartao surgir">
          <h2 className="cartao-titulo">Manutenções</h2>
          <p className="cartao-sub">{q.proximaRevisao ? `Próxima revisão em ${dataCurta(q.proximaRevisao)}.` : "Sem revisão programada."}</p>
          {q.manutencoes.length === 0 ? <p className="fraco" style={{ fontSize: 13, marginTop: 8 }}>Nenhuma manutenção registrada.</p> : (
            <div className="tabela-caixa" style={{ marginTop: 10 }}><table className="tabela tabela-compacta">
              <thead><tr><th>Data</th><th>Tipo</th><th>Serviço</th><th>Próxima revisão</th><th className="dir">Custo</th></tr></thead>
              <tbody>{q.manutencoes.map((m) => (
                <tr key={m.id}><td className="num">{dataCurta(m.data)}</td><td>{ROTULO_MANUTENCAO[m.tipo]}</td><td>{m.descricao}{m.por && <div className="fraco">{m.por}</div>}</td>
                  <td className="num">{dataCurta(m.proximaRevisao)}</td><td className="dir num">{m.custo != null ? moeda(m.custo) : "—"}</td></tr>
              ))}</tbody>
              {custoManut > 0 && <tfoot><tr className="linha-total"><td colSpan={4}>Total</td><td className="dir num">{moeda(custoManut)}</td></tr></tfoot>}
            </table></div>
          )}
          {q.podeGerenciar && (
            <FormAcao acao={acaoManutencao.bind(null, id)} className="grade-form form-base" style={{ marginTop: 14 }} limpar>
              <div className="campo c4"><label htmlFor="m-d">Data</label><input id="m-d" name="data" type="date" max={hoje()} defaultValue={hoje()} className="entrada-texto" required /></div>
              <div className="campo c4"><label htmlFor="m-t">Tipo</label>
                <select id="m-t" name="tipo" className="entrada-texto" defaultValue="preventiva">{Object.entries(ROTULO_MANUTENCAO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select></div>
              <div className="campo c4"><label htmlFor="m-c">Custo (R$)</label><input id="m-c" name="custo" inputMode="decimal" className="entrada-texto num" /></div>
              <div className="campo c8"><label htmlFor="m-s">Serviço feito</label><input id="m-s" name="descricao" className="entrada-texto" required /></div>
              <div className="campo c4"><label htmlFor="m-p">Próxima revisão</label><input id="m-p" name="proximaRevisao" type="date" className="entrada-texto" /></div>
              <div className="c12 rodape-form"><BotaoEnviar enviando="Registrando…"><Wrench /> Registrar manutenção</BotaoEnviar></div>
            </FormAcao>
          )}
        </section>

        <div className="grade">
          {q.podeGerenciar && (
            <section className="cartao surgir">
              <h2 className="cartao-titulo">Cadastro</h2>
              <FormAcao acao={acaoSalvarEquipamento.bind(null, id)} className="grade-form" style={{ marginTop: 10 }}>
                <div className="campo c8"><label htmlFor="e-d">Descrição</label><input id="e-d" name="descricao" defaultValue={q.descricao} className="entrada-texto" required /></div>
                <div className="campo c4"><label htmlFor="e-i">Identificação</label><input id="e-i" name="identificacao" defaultValue={q.identificacao ?? ""} className="entrada-texto" /></div>
                <div className="campo c4"><label htmlFor="e-p">Propriedade</label>
                  <select id="e-p" name="propriedade" className="entrada-texto" defaultValue={q.propriedade}><option value="proprio">Próprio</option><option value="locado">Locado</option></select></div>
                <div className="campo c8"><label htmlFor="e-e">Locadora</label>
                  <select id="e-e" name="empresaId" className="entrada-texto" defaultValue={q.empresaId ?? ""}><option value="">—</option>{q.empresas.map((e) => <option key={e.id} value={e.id}>{e.razaoSocial}</option>)}</select></div>
                <div className="campo c6"><label htmlFor="e-h">Custo por hora (R$)</label><input id="e-h" name="custoHora" defaultValue={paraCampo(q.custoHora == null ? null : String(q.custoHora))} inputMode="decimal" className="entrada-texto num" /></div>
                <div className="campo c6"><label htmlFor="e-a">Situação</label>
                  <select id="e-a" name="ativo" className="entrada-texto" defaultValue={q.ativo ? "sim" : "nao"}><option value="sim">Ativo</option><option value="nao">Inativo</option></select></div>
                <div className="c12 rodape-form"><BotaoEnviar enviando="Salvando…"><Save /> Salvar</BotaoEnviar></div>
              </FormAcao>
            </section>
          )}
          <section className="cartao surgir">
            <h2 className="cartao-titulo">Obras</h2>
            {q.alocacoes.length === 0 ? <p className="fraco" style={{ fontSize: 13, marginTop: 8 }}>Ainda não alocado em obra.</p> : (
              <div className="tabela-caixa" style={{ marginTop: 10 }}><table className="tabela tabela-compacta">
                <thead><tr><th>Obra</th><th>Período</th></tr></thead>
                <tbody>{q.alocacoes.map((x) => (
                  <tr key={x.id}><td><Link href={`/obras/${x.obraId}/equipes`} className="forte num">{x.obraCodigo}</Link><div className="fraco">{x.obraNome}</div></td>
                    <td className="num sem-quebra">{dataCurta(x.inicio)} a {x.fim ? dataCurta(x.fim) : "atual"}</td></tr>
                ))}</tbody>
              </table></div>
            )}
          </section>
          <section className="cartao surgir">
            <h2 className="cartao-titulo">Horas trabalhadas</h2>
            {q.horas.length === 0 ? <p className="fraco" style={{ fontSize: 13, marginTop: 8 }}>Nenhum apontamento.</p> : (
              <div className="tabela-caixa" style={{ marginTop: 10 }}><table className="tabela tabela-compacta">
                <thead><tr><th>Data</th><th>Obra</th><th>Serviço</th><th className="dir">Horas</th></tr></thead>
                <tbody>{q.horas.map((h, k) => (
                  <tr key={k}><td className="num">{dataCurta(h.data)}</td><td className="num">{h.obraCodigo}</td><td>{h.item ?? "—"}</td><td className="dir num">{numero(h.horas, 1)}</td></tr>
                ))}</tbody>
                <tfoot><tr className="linha-total"><td colSpan={3}>Total{q.custoHora != null ? ` · ${moeda(totalHoras * q.custoHora)}` : ""}</td><td className="dir num">{numero(totalHoras, 1)}</td></tr></tfoot>
              </table></div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
