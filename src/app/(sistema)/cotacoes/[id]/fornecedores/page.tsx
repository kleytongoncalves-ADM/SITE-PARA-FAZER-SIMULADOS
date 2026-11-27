import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardPen, Mail, RefreshCw, Send, X } from "lucide-react";
import { dataHoraCurta, EtiquetaConvite } from "@/componentes/cotacao/Pecas";
import { BotaoEnviar, FormAcao } from "@/componentes/FormAcao";
import { moeda, percentual } from "@/lib/formato";
import { formatarCnpj } from "@/servicos/contratos";
import { fornecedoresDisponiveis } from "@/servicos/cotacoes";
import { resumoDaConta } from "@/servicos/fornecedores";
import { acaoEnviar, acaoNovoLink, acaoReenviarEmail, acaoRemoverConvite } from "../../acoes";
import { carregarSolicitacao } from "../carregar";
import { AcoesLink } from "./AcoesLink";
import { ConvidarFornecedores } from "./ConvidarFornecedores";

const VIA = { manual: null, email: "Por e-mail", link: "Pelo link" } as const;
const EMAIL: Record<string, { texto: string; cor: string }> = {
  pendente: { texto: "E-mail sai no envio", cor: "et-neutra" }, enviado: { texto: "E-mail enviado", cor: "et-verde" },
  falhou: { texto: "E-mail não entregue", cor: "et-vermelha" }, sem_servico: { texto: "Envie o link", cor: "et-laranja" },
};

import "@/estilos/fornecedores.css";

export const metadata: Metadata = { title: "Fornecedores da cotação" };

export default async function FornecedoresDaCotacao({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ator, usuario, s } = await carregarSolicitacao(id);
  const podeConvidar = s.podeSolicitar && (s.situacao === "rascunho" || s.situacao === "aberta");
  const disponiveis = podeConvidar ? await fornecedoresDisponiveis(ator, id) : [];
  const totais = new Map((s.mapa?.fornecedores ?? []).map((f) => [f.conviteId, f]));
  const propostas = new Map(s.propostas.map((p) => [p.conviteId, p]));
  const rascunho = s.situacao === "rascunho";
  const contas = new Map(await Promise.all([...new Set(s.convites.map((c) => c.contaId).filter((x): x is string => !!x))]
    .map(async (c) => [c, await resumoDaConta(c)] as const)));

  return (
    <div className="grade">
      {rascunho && s.podeSolicitar && (
        <section className="cartao surgir">
          <h2 className="cartao-titulo">Enviar solicitação</h2>
          <p className="cartao-sub">{s.convites.length} {s.convites.length === 1 ? "fornecedor convidado" : "fornecedores convidados"}{s.linkAberto ? " e link compartilhado criado" : ""}. Depois do envio, materiais, quantidades e critério não mudam.</p>
          <FormAcao acao={acaoEnviar.bind(null, id)} confirmar={s.convites.length ? `Enviar a solicitação a ${s.convites.length} ${s.convites.length === 1 ? "fornecedor" : "fornecedores"}?` : "Abrir a solicitação pelo link compartilhado?"}>
            {s.convites.length < 3 && !s.linkAberto && (
              <div className="campo" style={{ marginTop: 12 }}>
                <label htmlFor="justificativa">Justificativa para menos de três fornecedores</label>
                <textarea id="justificativa" name="justificativa" className="entrada-texto" rows={2} minLength={10} required placeholder="Ex.: material com fornecedor exclusivo na região" />
              </div>
            )}
            <div className="rodape-form"><BotaoEnviar enviando="Enviando…"><Send /> Enviar solicitação</BotaoEnviar></div>
          </FormAcao>
        </section>
      )}

      {s.convites.length === 0 ? (
        <div className="cartao vazio"><b>Nenhum fornecedor convidado</b>{podeConvidar ? (s.linkAberto ? "Quem entrar pelo link compartilhado aparece aqui." : "Convide ao menos três para comparar preços.") : null}</div>
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
                <div className="cot-fornecedor-selos">
                  {VIA[c.via] && <span className="etiqueta et-azul">{VIA[c.via]}</span>}
                  {c.emailSituacao && <span className={`etiqueta ${EMAIL[c.emailSituacao].cor}`} title={c.emailErro ?? undefined}>{EMAIL[c.emailSituacao].texto}</span>}
                  {c.contaId && <span className="etiqueta et-verde">Com cadastro</span>}
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
                  {c.emailEnviadoEm && <><dt>E-mail</dt><dd className="num">enviado em {dataHoraCurta(c.emailEnviadoEm)}</dd></>}
                </dl>
                {c.contaId && contas.get(c.contaId) && (() => {
                  const r = contas.get(c.contaId)!;
                  return (
                    <details className="cot-historico">
                      <summary>Histórico na plataforma: {r.historico.recebidas} {r.historico.recebidas === 1 ? "cotação recebida" : "cotações recebidas"}, {r.historico.respondidas} respondidas, {r.historico.ganhas} com itens ganhos{r.experiencias.length ? ` · ${r.experiencias.length} ${r.experiencias.length === 1 ? "experiência declarada" : "experiências declaradas"}` : ""}</summary>
                      {r.historico.noPrazo != null && <p className="fraco">Entregas no prazo: {r.historico.noPrazo}% de {r.historico.entregas}</p>}
                      {r.experiencias.length > 0 && <ul>{r.experiencias.map((x) => <li key={x.id}><span className="etiqueta et-neutra">Declarado</span> {x.servico} · {x.cliente}{x.cidade || x.uf ? ` (${[x.cidade, x.uf].filter(Boolean).join("/")})` : ""}{x.ano ? ` · ${x.ano}` : ""}{x.quantidade ? ` · ${x.quantidade}` : ""}</li>)}</ul>}
                    </details>
                  );
                })()}
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
                    {s.situacao === "aberta" && c.email && s.emailAutomatico && !["respondeu", "declinou"].includes(c.situacao) && (
                      <FormAcao acao={acaoReenviarEmail.bind(null, id, c.id)}>
                        <BotaoEnviar className="botao botao-texto" enviando="Enviando…"><Mail /> {c.emailSituacao === "enviado" ? "Reenviar e-mail" : "Enviar e-mail"}</BotaoEnviar>
                      </FormAcao>
                    )}
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
        <ConvidarFornecedores id={id} rascunho={rascunho} emailAutomatico={s.emailAutomatico} linkAberto={s.linkAberto} orgao={usuario.orgaoNome} titulo={s.titulo}
          prazo={dataHoraCurta(s.prazo)} jaConvidados={s.convites.map((c) => c.cnpj)}
          sugestoes={disponiveis.map((e) => ({ razaoSocial: e.razaoSocial, cnpj: e.cnpj, email: e.email }))} />
      )}
    </div>
  );
}
