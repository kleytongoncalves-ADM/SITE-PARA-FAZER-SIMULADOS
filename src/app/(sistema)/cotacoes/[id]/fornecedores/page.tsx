import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardPen, RefreshCw, Send, UserPlus, X } from "lucide-react";
import { dataHoraCurta, EtiquetaConvite } from "@/componentes/cotacao/Pecas";
import { BotaoEnviar, FormAcao } from "@/componentes/FormAcao";
import { moeda, percentual } from "@/lib/formato";
import { formatarCnpj } from "@/servicos/contratos";
import { fornecedoresDisponiveis } from "@/servicos/cotacoes";
import { acaoConvidar, acaoEnviar, acaoNovoLink, acaoRemoverConvite } from "../../acoes";
import { carregarSolicitacao } from "../carregar";
import { AcoesLink } from "./AcoesLink";

export const metadata: Metadata = { title: "Fornecedores da cotação" };

export default async function FornecedoresDaCotacao({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ator, usuario, s } = await carregarSolicitacao(id);
  const podeConvidar = s.podeSolicitar && (s.situacao === "rascunho" || s.situacao === "aberta");
  const disponiveis = podeConvidar ? await fornecedoresDisponiveis(ator, id) : [];
  const totais = new Map((s.mapa?.fornecedores ?? []).map((f) => [f.conviteId, f]));
  const propostas = new Map(s.propostas.map((p) => [p.conviteId, p]));
  const rascunho = s.situacao === "rascunho";

  return (
    <div className="grade">
      {rascunho && s.podeSolicitar && (
        <section className="cartao surgir">
          <h2 className="cartao-titulo">Enviar solicitação</h2>
          <p className="cartao-sub">{s.convites.length} {s.convites.length === 1 ? "fornecedor convidado" : "fornecedores convidados"}. Depois do envio, materiais, quantidades e critério não mudam.</p>
          <FormAcao acao={acaoEnviar.bind(null, id)} confirmar={`Enviar a solicitação a ${s.convites.length} ${s.convites.length === 1 ? "fornecedor" : "fornecedores"}?`}>
            {s.convites.length < 3 && (
              <div className="campo" style={{ marginTop: 12 }}>
                <label htmlFor="justificativa">Justificativa para menos de três fornecedores</label>
                <textarea id="justificativa" name="justificativa" className="entrada-texto" rows={2} minLength={10} required placeholder="Ex.: material com fornecedor exclusivo na região" />
              </div>
            )}
            <div className="rodape-form"><BotaoEnviar enviando="Enviando…"><Send /> Enviar e gerar os links</BotaoEnviar></div>
          </FormAcao>
        </section>
      )}

      {s.convites.length === 0 ? (
        <div className="cartao vazio"><b>Nenhum fornecedor convidado</b>{podeConvidar ? "Convide ao menos três para comparar preços." : null}</div>
      ) : (
        <div className="cot-fornecedores">
          {s.convites.map((c, i) => {
            const t = totais.get(c.id);
            const p = propostas.get(c.id);
            return (
              <article key={c.id} className="cot-fornecedor surgir" style={{ "--i": i } as React.CSSProperties}>
                <div className="cot-fornecedor-topo">
                  <div style={{ minWidth: 0 }}><b>{c.razaoSocial}</b><div className="fraco num" style={{ fontSize: 12.5 }}>{formatarCnpj(c.cnpj)}</div></div>
                  {rascunho ? <span className="etiqueta et-neutra">A enviar</span> : <EtiquetaConvite situacao={c.situacao} />}
                </div>
                <dl>
                  {c.contato && <><dt>Contato</dt><dd>{c.contato}</dd></>}
                  {c.email && <><dt>E-mail</dt><dd>{c.email}</dd></>}
                  {c.telefone && <><dt>Telefone</dt><dd className="num">{c.telefone}</dd></>}
                  {c.abertoEm && <><dt>Abriu o link</dt><dd className="num">{dataHoraCurta(c.abertoEm)}</dd></>}
                  {c.respostaEm && <><dt>Proposta</dt><dd className="num">{dataHoraCurta(c.respostaEm)} · v{c.versao}{c.origem === "equipe" ? " · lançada pela equipe" : ""}</dd></>}
                  {c.declinouEm && <><dt>Declinou</dt><dd>{dataHoraCurta(c.declinouEm)}{c.declinouMotivo ? ` · ${c.declinouMotivo}` : ""}</dd></>}
                  {p && <><dt>Entrega</dt><dd>{p.prazoEntrega != null ? `${p.prazoEntrega} dias` : "—"}{p.pagamentoDias != null ? ` · pagamento em ${p.pagamentoDias} dias` : ""}{p.garantiaMeses != null ? ` · garantia de ${p.garantiaMeses} meses` : ""}</dd></>}
                  {p?.documento && <><dt>Documento</dt><dd>{p.documento}</dd></>}
                  {t && <><dt>Total</dt><dd className="num">{moeda(t.total)}</dd></>}
                  {c.historico != null && <><dt>Entregas no prazo</dt><dd className="num">{percentual(c.historico, 0)}</dd></>}
                  {c.motivo && <><dt>Motivo do convite</dt><dd>{c.motivo}</dd></>}
                </dl>
                {c.cotados != null && (
                  <div>
                    <div className="cot-cobertura" aria-hidden="true"><i style={{ width: `${(c.cotados / s.materiais.length) * 100}%` }} /></div>
                    <small className="fraco">{c.cotados} de {s.materiais.length} itens cotados</small>
                  </div>
                )}
                {c.link && <AcoesLink caminho={c.link} fornecedor={c.razaoSocial} orgao={usuario.orgaoNome} titulo={s.titulo} prazo={dataHoraCurta(s.prazo)} email={c.email} telefone={c.telefone} />}
                {s.podeSolicitar && (rascunho || s.situacao === "aberta") && (
                  <div className="cot-fornecedor-acoes">
                    {s.situacao === "aberta" && <Link href={`/cotacoes/${id}/lancar/${c.id}`} className="botao botao-texto"><ClipboardPen /> Lançar proposta recebida</Link>}
                    {s.situacao === "aberta" && (
                      <FormAcao acao={acaoNovoLink.bind(null, id, c.id)} confirmar="Gerar novo link? O link atual deixa de funcionar.">
                        <BotaoEnviar className="botao botao-texto" enviando="Gerando…"><RefreshCw /> Novo link</BotaoEnviar>
                      </FormAcao>
                    )}
                    {rascunho && (
                      <FormAcao acao={acaoRemoverConvite.bind(null, id, c.id)}>
                        <BotaoEnviar className="botao botao-texto" enviando="Removendo…"><X /> Remover</BotaoEnviar>
                      </FormAcao>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {podeConvidar && (
        <section className="cartao surgir">
          <h2 className="cartao-titulo">Convidar fornecedor</h2>
          <FormAcao acao={acaoConvidar.bind(null, id)} className="cot-convite-form" style={{ marginTop: 12 }} limpar mostrarOk={false}>
            <div className="campo" style={{ gridColumn: "span 12" }}>
              <label htmlFor="empresaId">Fornecedor cadastrado</label>
              <select id="empresaId" name="empresaId" className="entrada-texto" defaultValue="">
                <option value="">Novo fornecedor (preencha abaixo)</option>
                {disponiveis.map((e) => <option key={e.id} value={e.id}>{e.razaoSocial} · {formatarCnpj(e.cnpj)}{e.convites ? ` · respondeu ${e.respostas} de ${e.convites}` : ""}</option>)}
              </select>
            </div>
            <div className="campo" style={{ gridColumn: "span 8" }}><label htmlFor="razaoSocial">Razão social</label><input id="razaoSocial" name="razaoSocial" className="entrada-texto" maxLength={160} /></div>
            <div className="campo" style={{ gridColumn: "span 4" }}><label htmlFor="cnpj">CNPJ</label><input id="cnpj" name="cnpj" className="entrada-texto" inputMode="numeric" placeholder="00.000.000/0000-00" /></div>
            <div className="campo" style={{ gridColumn: "span 4" }}><label htmlFor="contato">Contato</label><input id="contato" name="contato" className="entrada-texto" maxLength={120} /></div>
            <div className="campo" style={{ gridColumn: "span 4" }}><label htmlFor="email">E-mail</label><input id="email" name="email" type="email" className="entrada-texto" maxLength={160} /></div>
            <div className="campo" style={{ gridColumn: "span 4" }}><label htmlFor="telefone">Telefone</label><input id="telefone" name="telefone" className="entrada-texto" maxLength={40} /></div>
            <div className="campo" style={{ gridColumn: "span 9" }}><label htmlFor="motivo">Motivo do convite (opcional)</label><input id="motivo" name="motivo" className="entrada-texto" maxLength={300} /></div>
            <div style={{ gridColumn: "span 3", display: "flex", justifyContent: "flex-end" }}><BotaoEnviar enviando="Convidando…"><UserPlus /> Convidar</BotaoEnviar></div>
          </FormAcao>
        </section>
      )}
    </div>
  );
}
