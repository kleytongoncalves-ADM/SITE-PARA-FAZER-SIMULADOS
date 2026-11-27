"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { Avisos } from "@/componentes/Avisos";
import type { Experiencia, MinhaEmpresa } from "@/servicos/fornecedores";
import {
  acaoAdicionarExperiencia, acaoRemoverExperiencia, acaoSalvarAvisos, acaoSalvarEmpresa, acaoTrocarSenhaFornecedor, type Estado,
} from "../../acoes";

const erro = (e: Estado, k: string) => (e.erros?.[k] ? <span className="erro">{e.erros[k]}</span> : null);

export function FormDadosEmpresa({ e, admin }: { e: MinhaEmpresa; admin: boolean }) {
  const [s, acao, enviando] = useActionState<Estado, FormData>(acaoSalvarEmpresa, {});
  return (
    <form action={acao} className="grade-form" style={{ marginTop: 12 }}>
      <div className="c12"><Avisos erro={s.erros ? undefined : s.erro} ok={s.ok} /></div>
      <div className="campo c12"><label htmlFor="e-razao">Razão social</label><input id="e-razao" name="razaoSocial" readOnly={!admin} className="entrada-texto" defaultValue={e.razaoSocial} required maxLength={160} />{erro(s, "razaoSocial")}</div>
      <div className="campo c6"><label htmlFor="e-fant">Nome fantasia</label><input id="e-fant" name="nomeFantasia" readOnly={!admin} className="entrada-texto" defaultValue={e.nomeFantasia ?? ""} maxLength={160} /></div>
      <div className="campo c6"><label htmlFor="e-tel">Telefone</label><input id="e-tel" name="telefone" readOnly={!admin} className="entrada-texto" defaultValue={e.telefone ?? ""} maxLength={40} /></div>
      <div className="campo c9"><label htmlFor="e-cid">Cidade</label><input id="e-cid" name="cidade" readOnly={!admin} className="entrada-texto" defaultValue={e.cidade ?? ""} maxLength={80} /></div>
      <div className="campo c3"><label htmlFor="e-uf">UF</label><input id="e-uf" name="uf" readOnly={!admin} className="entrada-texto" defaultValue={e.uf ?? ""} maxLength={2} style={{ textTransform: "uppercase" }} />{erro(s, "uf")}</div>
      <div className="campo c6"><label htmlFor="e-nome">Seu nome</label><input id="e-nome" name="nome" className="entrada-texto" defaultValue={e.nome} required maxLength={120} />{erro(s, "nome")}</div>
      <div className="campo c6"><label htmlFor="e-email">Seu e-mail de acesso</label><input id="e-email" name="email" type="email" className="entrada-texto" defaultValue={e.email} required maxLength={160} />{erro(s, "email")}</div>
      <div className="c12 rodape-form"><button className="botao botao-primario" disabled={enviando}><Save /> {enviando ? "Salvando…" : "Salvar"}</button></div>
    </form>
  );
}

export function FormAvisos({ e }: { e: MinhaEmpresa }) {
  const [s, acao, enviando] = useActionState<Estado, FormData>(acaoSalvarAvisos, {});
  return (
    <form action={acao} className="grade" style={{ marginTop: 12, gap: 12 }}>
      <Avisos erro={s.erro} ok={s.ok} />
      <label className="opcao-check"><input type="checkbox" checked disabled /> Caixa de mensagens da área do fornecedor</label>
      <label className="opcao-check"><input type="checkbox" name="avisosEmail" defaultChecked={e.avisosEmail} /> E-mail para {e.email}</label>
      <label className="opcao-check"><input type="checkbox" name="avisosWhatsapp" defaultChecked={e.avisosWhatsapp} /> WhatsApp</label>
      <div className="campo"><label htmlFor="a-zap">Celular do WhatsApp, com DDD</label><input id="a-zap" name="whatsapp" className="entrada-texto" inputMode="tel" defaultValue={e.whatsapp ?? ""} placeholder="(21) 99999-0000" maxLength={20} /></div>
      <label className="opcao-check"><input type="checkbox" name="autorizo" defaultChecked={e.whatsappAutorizado} /> Autorizo o CiviObras a enviar avisos de cotação para este número.</label>
      <p className="cartao-sub">Pelo WhatsApp, só chegam avisos dos órgãos que ligaram esse envio. Pode desmarcar quando quiser.</p>
      <div className="rodape-form"><button className="botao botao-neutro" disabled={enviando}><Save /> {enviando ? "Salvando…" : "Salvar avisos"}</button></div>
    </form>
  );
}

export function FormSenha() {
  const [s, acao, enviando] = useActionState<Estado, FormData>(acaoTrocarSenhaFornecedor, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (s.ok) ref.current?.reset(); }, [s]);
  return (
    <form ref={ref} action={acao} className="grade-form" style={{ marginTop: 12 }}>
      <div className="c12"><Avisos erro={s.erro} ok={s.ok} /></div>
      <div className="campo c12"><label htmlFor="s-atual">Senha atual</label><input id="s-atual" name="atual" type="password" className="entrada-texto" required autoComplete="current-password" /></div>
      <div className="campo c6"><label htmlFor="s-nova">Nova senha</label><input id="s-nova" name="nova" type="password" className="entrada-texto" required minLength={6} maxLength={10} autoComplete="new-password" /></div>
      <div className="campo c6"><label htmlFor="s-conf">Confirmar</label><input id="s-conf" name="confirmar" type="password" className="entrada-texto" required minLength={6} maxLength={10} autoComplete="new-password" /></div>
      <p className="cartao-sub c12">6 a 10 caracteres, com letra, número e caractere especial.</p>
      <div className="c12 rodape-form"><button className="botao botao-neutro" disabled={enviando}>{enviando ? "Alterando…" : "Alterar senha"}</button></div>
    </form>
  );
}

export function ListaExperiencias({ itens, admin = true }: { itens: Experiencia[]; admin?: boolean }) {
  const [ocupado, iniciar] = useTransition();
  if (!itens.length) return <div className="vazio" style={{ padding: "14px 0" }}>Nenhuma experiência informada.</div>;
  return (
    <div className="tabela-caixa" style={{ marginTop: 12 }}>
      <table className="tabela tabela-compacta">
        <thead><tr><th>Cliente ou órgão</th><th>Serviço ou fornecimento</th><th>Local</th><th>Ano</th><th>Quantidade</th><th /></tr></thead>
        <tbody>{itens.map((x) => (
          <tr key={x.id}>
            <td><b>{x.cliente}</b> <span className="etiqueta et-neutra">Declarado</span></td><td>{x.servico}</td>
            <td>{[x.cidade, x.uf].filter(Boolean).join("/") || "—"}</td><td className="num">{x.ano ?? "—"}</td><td>{x.quantidade ?? "—"}</td>
            <td className="dir">{admin && <button type="button" className="botao botao-texto" disabled={ocupado} onClick={() => iniciar(async () => { await acaoRemoverExperiencia(x.id); })} aria-label={`Remover ${x.cliente}`}><Trash2 /></button>}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export function FormExperiencia() {
  const [s, acao, enviando] = useActionState<Estado, FormData>(acaoAdicionarExperiencia, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (s.ok) ref.current?.reset(); }, [s]);
  return (
    <form ref={ref} action={acao} className="grade-form" style={{ marginTop: 14 }}>
      <div className="c12"><Avisos erro={s.erro} /></div>
      <div className="campo c4"><label htmlFor="x-cli">Cliente ou órgão</label><input id="x-cli" name="cliente" className="entrada-texto" required maxLength={160} placeholder="Prefeitura de…" /></div>
      <div className="campo c4"><label htmlFor="x-serv">Serviço ou fornecimento</label><input id="x-serv" name="servico" className="entrada-texto" required maxLength={200} placeholder="Fornecimento de blocos cerâmicos" /></div>
      <div className="campo c2"><label htmlFor="x-cid">Cidade</label><input id="x-cid" name="cidade" className="entrada-texto" maxLength={80} /></div>
      <div className="campo c2"><label htmlFor="x-uf">UF</label><input id="x-uf" name="uf" className="entrada-texto" maxLength={2} style={{ textTransform: "uppercase" }} /></div>
      <div className="campo c2"><label htmlFor="x-ano">Ano</label><input id="x-ano" name="ano" className="entrada-texto" inputMode="numeric" maxLength={4} /></div>
      <div className="campo c4"><label htmlFor="x-qtd">Quantidade</label><input id="x-qtd" name="quantidade" className="entrada-texto" maxLength={80} placeholder="12.000 un" /></div>
      <div className="c6 rodape-form" style={{ alignSelf: "end" }}><button className="botao botao-neutro" disabled={enviando}><Plus /> {enviando ? "Incluindo…" : "Incluir experiência"}</button></div>
    </form>
  );
}
