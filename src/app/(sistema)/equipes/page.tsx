import type { Metadata } from "next";
import Link from "next/link";
import { FilePlus2, Truck, UserPlus } from "lucide-react";
import { BotaoEnviar, FormAcao } from "@/componentes/FormAcao";
import { dataCurta, moeda, numero } from "@/lib/formato";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { painelModuloEquipes, ROTULO_DOC_EMPRESA, TIPOS_DOC_EMPRESA } from "@/servicos/equipes";
import { pode } from "@/servicos/permissoes";
import { acaoDocumentoEmpresa, acaoSalvarEquipamento, acaoSalvarPessoa } from "./acoes";
import { SituacaoEquipamento, SituacaoHabilitacao } from "./Componentes";

export const metadata: Metadata = { title: "Equipes e recursos" };
const cpfFmt = (c: string) => c.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
const cnpjFmt = (c: string) => c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");

export default async function Equipes() {
  const ator = comoAtor(await exigirUsuario());
  if (!pode(ator, "equipes.ver")) return <div className="cartao vazio"><b>Seu perfil não acessa as equipes</b></div>;
  const p = await painelModuloEquipes(ator);
  const ativas = p.pessoas.filter((x) => x.ativa);
  const eqAtivos = p.equipamentos.filter((x) => x.ativo);
  const comDocs = p.empresas.filter((e) => e.documentos.length > 0 || e.pessoas > 0 || e.tipo !== "fornecedor");

  return (
    <>
      <div className="cabecalho">
        <div><div className="sobretitulo">Executar</div><h1 className="titulo">Equipes e recursos</h1></div>
      </div>
      <div className="indicadores">
        <div className="indicador surgir"><span>Pessoas ativas</span><b className="num">{ativas.length}</b><small>{ativas.filter((x) => x.obraAtual).length} alocadas em obra</small></div>
        <div className={`indicador surgir${p.pendentes ? " indicador-destaque" : ""}`}><span>ASO ou treinamento vencido</span><b className="num">{p.pendentes}</b><small>{p.vencendo} {p.vencendo === 1 ? "vence" : "vencem"} em 30 dias</small></div>
        <div className={`indicador surgir${p.indisponiveis ? " indicador-destaque" : ""}`}><span>Equipamentos</span><b className="num">{eqAtivos.length}</b><small>{p.indisponiveis} com manutenção vencida</small></div>
        <div className={`indicador surgir${p.documentosVencidos ? " indicador-destaque" : ""}`}><span>Certidões de empresas vencidas</span><b className="num">{p.documentosVencidos}</b><small>{p.documentosVencendo} {p.documentosVencendo === 1 ? "vence" : "vencem"} em 30 dias</small></div>
      </div>

      {p.obras.length > 0 && (
        <section className="cartao surgir" style={{ marginBottom: 16 }}>
          <h2 className="cartao-titulo">Obras em execução</h2>
          <div className="tabela-caixa" style={{ marginTop: 10 }}><table className="tabela tabela-compacta">
            <thead><tr><th>Obra</th><th className="dir">Pessoas</th><th className="dir">Equipamentos</th><th className="dir">Horas no mês</th></tr></thead>
            <tbody>{p.obras.map((o) => (
              <tr key={o.id}><td><Link href={`/obras/${o.id}/equipes`} className="forte">{o.nome}</Link><div className="fraco num">{o.codigo}</div></td>
                <td className="dir num">{o.pessoas}</td><td className="dir num">{o.equipamentos}</td><td className="dir num">{o.horasMes ? `${numero(o.horasMes, 1)} h` : "—"}</td></tr>
            ))}</tbody>
          </table></div>
        </section>
      )}

      <div className="grade">
        <section className="cartao surgir">
          <h2 className="cartao-titulo">Pessoas</h2>
          {p.pessoas.length === 0 ? <p className="fraco" style={{ fontSize: 13, marginTop: 8 }}>Nenhuma pessoa cadastrada.</p> : (
            <div className="tabela-caixa" style={{ marginTop: 10 }}><table className="tabela tabela-compacta">
              <thead><tr><th>Nome</th><th>Função</th><th>Empresa</th><th className="dir">Custo/h</th><th>Obra atual</th><th>ASO e treinamentos</th></tr></thead>
              <tbody>{p.pessoas.map((x) => (
                <tr key={x.id} className={!x.ativa ? "linha-apagada" : x.pendencia ? "linha-vencida" : ""}>
                  <td><Link href={`/equipes/pessoas/${x.id}`} className="forte">{x.nome}</Link><div className="fraco num">{cpfFmt(x.cpf)}</div></td>
                  <td>{x.funcao}</td><td>{x.empresa ?? "Equipe própria"}</td>
                  <td className="dir num">{x.custoHora != null ? moeda(x.custoHora) : "—"}</td>
                  <td className="num">{x.obraAtualId ? <Link href={`/obras/${x.obraAtualId}/equipes`}>{x.obraAtual}</Link> : "—"}</td>
                  <td>{x.ativa ? <SituacaoHabilitacao pendencia={x.pendencia} vencimento={x.proximoVencimento} item={x.proximoItem} /> : <span className="etiqueta et-neutra">Inativa</span>}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
          {p.podeGerenciar && (
            <FormAcao acao={acaoSalvarPessoa.bind(null, null)} className="grade-form form-base" style={{ marginTop: 14 }}>
              <div className="campo c4"><label htmlFor="np-n">Nome</label><input id="np-n" name="nome" className="entrada-texto" required /></div>
              <div className="campo c2"><label htmlFor="np-c">CPF</label><input id="np-c" name="cpf" inputMode="numeric" className="entrada-texto num" required /></div>
              <div className="campo c2"><label htmlFor="np-f">Função</label><input id="np-f" name="funcao" list="funcoes" className="entrada-texto" required /></div>
              <div className="campo c2"><label htmlFor="np-e">Empresa</label>
                <select id="np-e" name="empresaId" className="entrada-texto" defaultValue=""><option value="">Equipe própria</option>{p.empresas.map((e) => <option key={e.id} value={e.id}>{e.razaoSocial}</option>)}</select></div>
              <div className="campo c2"><label htmlFor="np-h">Custo por hora (R$)</label><input id="np-h" name="custoHora" inputMode="decimal" className="entrada-texto num" /></div>
              <datalist id="funcoes">{["Pedreiro", "Servente", "Carpinteiro", "Armador", "Eletricista", "Encanador", "Pintor", "Operador de máquina", "Encarregado", "Mestre de obras"].map((f) => <option key={f} value={f} />)}</datalist>
              <div className="c12 rodape-form"><BotaoEnviar enviando="Cadastrando…"><UserPlus /> Cadastrar pessoa</BotaoEnviar></div>
            </FormAcao>
          )}
        </section>

        <section className="cartao surgir">
          <h2 className="cartao-titulo">Equipamentos</h2>
          {p.equipamentos.length === 0 ? <p className="fraco" style={{ fontSize: 13, marginTop: 8 }}>Nenhum equipamento cadastrado.</p> : (
            <div className="tabela-caixa" style={{ marginTop: 10 }}><table className="tabela tabela-compacta">
              <thead><tr><th>Equipamento</th><th>Propriedade</th><th className="dir">Custo/h</th><th>Próxima revisão</th><th>Situação</th></tr></thead>
              <tbody>{p.equipamentos.map((q) => (
                <tr key={q.id} className={!q.ativo ? "linha-apagada" : !q.disponivel ? "linha-vencida" : ""}>
                  <td><Link href={`/equipes/equipamentos/${q.id}`} className="forte">{q.descricao}</Link>{q.identificacao && <div className="fraco">{q.identificacao}</div>}</td>
                  <td>{q.propriedade === "locado" ? `Locado · ${q.empresa}` : "Próprio"}</td>
                  <td className="dir num">{q.custoHora != null ? moeda(q.custoHora) : "—"}</td>
                  <td className="num">{dataCurta(q.proximaRevisao)}</td>
                  <td><SituacaoEquipamento ativo={q.ativo} disponivel={q.disponivel} obra={q.obraAtual} /></td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
          {p.podeGerenciar && (
            <FormAcao acao={acaoSalvarEquipamento.bind(null, null)} className="grade-form form-base" style={{ marginTop: 14 }}>
              <div className="campo c4"><label htmlFor="ne-d">Descrição</label><input id="ne-d" name="descricao" className="entrada-texto" required placeholder="Betoneira 400 L" /></div>
              <div className="campo c2"><label htmlFor="ne-i">Identificação</label><input id="ne-i" name="identificacao" className="entrada-texto" placeholder="Placa, série ou patrimônio" /></div>
              <div className="campo c2"><label htmlFor="ne-p">Propriedade</label>
                <select id="ne-p" name="propriedade" className="entrada-texto" defaultValue="proprio"><option value="proprio">Próprio</option><option value="locado">Locado</option></select></div>
              <div className="campo c2"><label htmlFor="ne-e">Locadora</label>
                <select id="ne-e" name="empresaId" className="entrada-texto" defaultValue=""><option value="">—</option>{p.empresas.map((e) => <option key={e.id} value={e.id}>{e.razaoSocial}</option>)}</select></div>
              <div className="campo c2"><label htmlFor="ne-h">Custo por hora (R$)</label><input id="ne-h" name="custoHora" inputMode="decimal" className="entrada-texto num" /></div>
              <div className="c12 rodape-form"><BotaoEnviar enviando="Cadastrando…"><Truck /> Cadastrar equipamento</BotaoEnviar></div>
            </FormAcao>
          )}
        </section>

        <section className="cartao surgir">
          <h2 className="cartao-titulo">Documentos das empresas</h2>
          <p className="cartao-sub">Certidão vigente mais recente de cada tipo.</p>
          {comDocs.length === 0 ? <p className="fraco" style={{ fontSize: 13, marginTop: 8 }}>Nenhuma empresa cadastrada.</p> : (
            <div className="tabela-caixa" style={{ marginTop: 10 }}><table className="tabela tabela-compacta">
              <thead><tr><th>Empresa</th><th className="dir">Pessoas</th><th>Documentos</th></tr></thead>
              <tbody>{comDocs.map((e) => (
                <tr key={e.id} className={e.vencidos ? "linha-vencida" : ""}>
                  <td><b>{e.razaoSocial}</b><div className="fraco num">{cnpjFmt(e.cnpj)}</div></td>
                  <td className="dir num">{e.pessoas || "—"}</td>
                  <td>{e.documentos.length === 0 ? <span className="fraco">Nenhum registrado</span> : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{e.documentos.map((d) => (
                      <span key={d.id} className={`etiqueta ${d.vencido ? "et-vermelha" : d.vencendo ? "et-laranja" : "et-verde"}`} title={d.numero ?? undefined}>
                        {ROTULO_DOC_EMPRESA[d.tipo]} · {d.vencido ? "venceu" : "até"} {dataCurta(d.validade)}
                      </span>
                    ))}</div>
                  )}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
          {p.podeGerenciar && p.empresas.length > 0 && (
            <FormAcao acao={acaoDocumentoEmpresa} className="grade-form form-base" style={{ marginTop: 14 }} limpar>
              <div className="campo c4"><label htmlFor="nd-e">Empresa</label>
                <select id="nd-e" name="empresaId" className="entrada-texto" required defaultValue=""><option value="" disabled>Escolha</option>{p.empresas.map((e) => <option key={e.id} value={e.id}>{e.razaoSocial}</option>)}</select></div>
              <div className="campo c3"><label htmlFor="nd-t">Documento</label>
                <select id="nd-t" name="tipo" className="entrada-texto" defaultValue="cnd_federal">{TIPOS_DOC_EMPRESA.map((t) => <option key={t} value={t}>{ROTULO_DOC_EMPRESA[t]}</option>)}</select></div>
              <div className="campo c2"><label htmlFor="nd-n">Número</label><input id="nd-n" name="numero" className="entrada-texto" /></div>
              <div className="campo c3"><label htmlFor="nd-v">Validade</label><input id="nd-v" name="validade" type="date" className="entrada-texto" required /></div>
              <div className="campo c3"><label htmlFor="nd-d">Emissão</label><input id="nd-d" name="emissao" type="date" className="entrada-texto" /></div>
              <div className="campo c9"><label htmlFor="nd-o">Observação</label><input id="nd-o" name="observacao" className="entrada-texto" /></div>
              <div className="c12 rodape-form"><BotaoEnviar enviando="Registrando…"><FilePlus2 /> Registrar documento</BotaoEnviar></div>
            </FormAcao>
          )}
        </section>
      </div>
    </>
  );
}
