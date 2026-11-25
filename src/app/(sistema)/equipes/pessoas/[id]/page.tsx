import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, Save } from "lucide-react";
import { BotaoEnviar, FormAcao } from "@/componentes/FormAcao";
import { ErroDeRegra } from "@/lib/db";
import { dataCurta, moeda, numero, paraCampo } from "@/lib/formato";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { ADICIONAL_EXTRA, ASOS, obterPessoa, TREINAMENTOS, type Habilitacao } from "@/servicos/equipes";
import { SemPermissao } from "@/servicos/permissoes";
import { acaoHabilitacao, acaoSalvarPessoa } from "../../acoes";
import { SituacaoHabilitacao } from "../../Componentes";

export const metadata: Metadata = { title: "Pessoa" };
const hoje = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const cpfFmt = (c: string) => c.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");

function Tabela({ lista, titulo }: { lista: Habilitacao[]; titulo: string }) {
  return (
    <>
      <h3 className="cartao-sub" style={{ marginTop: 12, fontWeight: 600 }}>{titulo}</h3>
      {lista.length === 0 ? <p className="fraco" style={{ fontSize: 13 }}>Nenhum registro.</p> : (
        <div className="tabela-caixa" style={{ marginTop: 6 }}><table className="tabela tabela-compacta">
          <thead><tr><th>Descrição</th><th>Realizado em</th><th>Validade</th>{titulo !== "ASO" && <th className="dir">Carga</th>}<th>Situação</th></tr></thead>
          <tbody>{lista.map((h) => (
            <tr key={h.id} className={!h.vigente ? "linha-apagada" : h.vencida ? "linha-vencida" : ""}>
              <td>{h.descricao}{h.tipo === "treinamento" && !h.obrigatorio && <div className="fraco">Complementar</div>}</td>
              <td className="num">{dataCurta(h.data)}</td><td className="num">{dataCurta(h.validade)}</td>
              {titulo !== "ASO" && <td className="dir num">{h.cargaHoraria ? `${h.cargaHoraria} h` : "—"}</td>}
              <td>{!h.vigente ? <span className="etiqueta et-neutra">Substituído</span> : h.vencida ? <span className="etiqueta et-vermelha">Vencido</span>
                : h.vencendo ? <span className="etiqueta et-laranja">Vence em breve</span> : <span className="etiqueta et-verde">Válido</span>}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </>
  );
}

export default async function PaginaPessoa({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ator = comoAtor(await exigirUsuario());
  let p;
  try {
    p = await obterPessoa(ator, id);
  } catch (e) {
    if (e instanceof ErroDeRegra || e instanceof SemPermissao) notFound();
    throw e;
  }
  const asos = p.habilitacoes.filter((h) => h.tipo === "aso");
  const treinos = p.habilitacoes.filter((h) => h.tipo === "treinamento");
  const totalNormais = p.horas.reduce((s, h) => s + h.normais, 0);
  const totalExtras = p.horas.reduce((s, h) => s + h.extras, 0);

  return (
    <>
      <div className="cabecalho">
        <div><div className="sobretitulo"><Link href="/equipes">Equipes e recursos</Link></div><h1 className="titulo">{p.nome}</h1>
          <div className="fraco" style={{ marginTop: 4 }}>{p.funcao} · {p.empresa ?? "Equipe própria"} · CPF {cpfFmt(p.cpf)}</div></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {p.ativa ? <SituacaoHabilitacao pendencia={p.pendencia} vencimento={p.proximoVencimento} item={p.proximoItem} /> : <span className="etiqueta et-neutra">Inativa</span>}
          <Link href="/equipes" className="botao botao-neutro"><ArrowLeft /> Equipes</Link>
        </div>
      </div>

      <div className="diario-colunas">
        <section className="cartao surgir">
          <h2 className="cartao-titulo">ASO e treinamentos</h2>
          <Tabela lista={asos} titulo="ASO" />
          <Tabela lista={treinos} titulo="Treinamentos" />
          {p.podeGerenciar && (
            <FormAcao acao={acaoHabilitacao.bind(null, id)} className="grade-form form-base" style={{ marginTop: 14 }} limpar>
              <div className="campo c4"><label htmlFor="h-t">Tipo</label>
                <select id="h-t" name="tipo" className="entrada-texto" defaultValue="treinamento"><option value="aso">ASO</option><option value="treinamento">Treinamento</option></select></div>
              <div className="campo c8"><label htmlFor="h-d">Descrição</label><input id="h-d" name="descricao" list="habilitacoes" className="entrada-texto" required /></div>
              <datalist id="habilitacoes">{[...ASOS, ...TREINAMENTOS].map((x) => <option key={x} value={x} />)}</datalist>
              <div className="campo c4"><label htmlFor="h-r">Realizado em</label><input id="h-r" name="data" type="date" max={hoje()} className="entrada-texto" required /></div>
              <div className="campo c4"><label htmlFor="h-v">Validade</label><input id="h-v" name="validade" type="date" className="entrada-texto" required /></div>
              <div className="campo c4"><label htmlFor="h-c">Carga horária (h)</label><input id="h-c" name="cargaHoraria" inputMode="numeric" className="entrada-texto num" /></div>
              <label className="opcao-check c8"><input type="checkbox" name="obrigatorio" value="sim" defaultChecked /> Obrigatório para trabalhar na obra</label>
              <div className="c4 rodape-form"><BotaoEnviar enviando="Registrando…"><BadgeCheck /> Registrar</BotaoEnviar></div>
            </FormAcao>
          )}
        </section>

        <div className="grade">
          {p.podeGerenciar && (
            <section className="cartao surgir">
              <h2 className="cartao-titulo">Cadastro</h2>
              <FormAcao acao={acaoSalvarPessoa.bind(null, id)} className="grade-form" style={{ marginTop: 10 }}>
                <div className="campo c8"><label htmlFor="p-n">Nome</label><input id="p-n" name="nome" defaultValue={p.nome} className="entrada-texto" required /></div>
                <div className="campo c4"><label htmlFor="p-c">CPF</label><input id="p-c" name="cpf" defaultValue={cpfFmt(p.cpf)} inputMode="numeric" className="entrada-texto num" required /></div>
                <div className="campo c6"><label htmlFor="p-f">Função</label><input id="p-f" name="funcao" defaultValue={p.funcao} className="entrada-texto" required /></div>
                <div className="campo c6"><label htmlFor="p-h">Custo por hora (R$)</label><input id="p-h" name="custoHora" defaultValue={paraCampo(p.custoHora == null ? null : String(p.custoHora))} inputMode="decimal" className="entrada-texto num" /></div>
                <div className="campo c8"><label htmlFor="p-e">Empresa</label>
                  <select id="p-e" name="empresaId" className="entrada-texto" defaultValue={p.empresaId ?? ""}><option value="">Equipe própria</option>{p.empresas.map((e) => <option key={e.id} value={e.id}>{e.razaoSocial}</option>)}</select></div>
                <div className="campo c4"><label htmlFor="p-a">Situação</label>
                  <select id="p-a" name="ativa" className="entrada-texto" defaultValue={p.ativa ? "sim" : "nao"}><option value="sim">Ativa</option><option value="nao">Inativa</option></select></div>
                <div className="c12 rodape-form"><BotaoEnviar enviando="Salvando…"><Save /> Salvar</BotaoEnviar></div>
              </FormAcao>
            </section>
          )}
          <section className="cartao surgir">
            <h2 className="cartao-titulo">Obras</h2>
            {p.alocacoes.length === 0 ? <p className="fraco" style={{ fontSize: 13, marginTop: 8 }}>Ainda não alocada em obra.</p> : (
              <div className="tabela-caixa" style={{ marginTop: 10 }}><table className="tabela tabela-compacta">
                <thead><tr><th>Obra</th><th>Função</th><th>Período</th></tr></thead>
                <tbody>{p.alocacoes.map((x) => (
                  <tr key={x.id}><td><Link href={`/obras/${x.obraId}/equipes`} className="forte num">{x.obraCodigo}</Link><div className="fraco">{x.obraNome}</div></td>
                    <td>{x.funcao ?? p.funcao}</td><td className="num sem-quebra">{dataCurta(x.inicio)} a {x.fim ? dataCurta(x.fim) : "atual"}</td></tr>
                ))}</tbody>
              </table></div>
            )}
          </section>
          <section className="cartao surgir">
            <h2 className="cartao-titulo">Horas apontadas</h2>
            {p.horas.length === 0 ? <p className="fraco" style={{ fontSize: 13, marginTop: 8 }}>Nenhum apontamento.</p> : (
              <div className="tabela-caixa" style={{ marginTop: 10 }}><table className="tabela tabela-compacta">
                <thead><tr><th>Data</th><th>Obra</th><th>Serviço</th><th className="dir">Normais</th><th className="dir">Extras</th></tr></thead>
                <tbody>{p.horas.map((h, k) => (
                  <tr key={k}><td className="num">{dataCurta(h.data)}</td><td className="num">{h.obraCodigo}</td><td>{h.item ?? "—"}</td>
                    <td className="dir num">{numero(h.normais, 1)}</td><td className="dir num">{h.extras ? numero(h.extras, 1) : "—"}</td></tr>
                ))}</tbody>
                <tfoot><tr className="linha-total"><td colSpan={3}>Total{p.custoHora != null ? ` · ${moeda((totalNormais + totalExtras * ADICIONAL_EXTRA) * p.custoHora)}` : ""}</td>
                  <td className="dir num">{numero(totalNormais, 1)}</td><td className="dir num">{numero(totalExtras, 1)}</td></tr></tfoot>
              </table></div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
