"use client";

import { useActionState } from "react";
import { Power, Save, Send, ShieldCheck } from "lucide-react";
import { Avisos } from "@/componentes/Avisos";
import { acaoInformarEmail, acaoLigarEmail, acaoSalvarWhatsapp, acaoTestarWhatsapp, acaoValidarCodigo, type Estado } from "../acoes";

export function FormEmailCorporativo({ email, nome }: { email: string | null; nome: string | null }) {
  const [s, acao, enviando] = useActionState<Estado, FormData>(acaoInformarEmail, {});
  return (
    <form action={acao} className="grade-form config-form">
      <div className="c12"><Avisos erro={s.erro} ok={s.ok} /></div>
      <div className="campo c6"><label htmlFor="cf-email">E-mail corporativo</label><input id="cf-email" name="email" type="email" required className="entrada-texto" defaultValue={email ?? ""} placeholder="compras@orgao.gov.br" maxLength={160} /></div>
      <div className="campo c6"><label htmlFor="cf-nome">Nome no remetente</label><input id="cf-nome" name="nome" className="entrada-texto" defaultValue={nome ?? ""} placeholder="Setor de Compras" maxLength={80} /></div>
      <div className="c12 rodape-form"><button className="botao botao-neutro" disabled={enviando}><Send /> {enviando ? "Enviando…" : email ? "Trocar e enviar código" : "Enviar código"}</button></div>
    </form>
  );
}

export function FormCodigo() {
  const [s, acao, enviando] = useActionState<Estado, FormData>(acaoValidarCodigo, {});
  return (
    <form action={acao} className="config-form config-codigo">
      <Avisos erro={s.erro} ok={s.ok} />
      <input name="codigo" className="entrada-texto num" inputMode="numeric" maxLength={6} required placeholder="000000" aria-label="Código de 6 dígitos" autoComplete="one-time-code" />
      <button className="botao botao-primario" disabled={enviando}><ShieldCheck /> {enviando ? "Validando…" : "Validar"}</button>
    </form>
  );
}

export function FormLigarEmail({ ligado }: { ligado: boolean }) {
  const [s, acao, enviando] = useActionState<Estado, FormData>(acaoLigarEmail, {});
  return (
    <form action={acao} className="config-form">
      <Avisos erro={s.erro} ok={s.ok} />
      <input type="hidden" name="ligar" value={ligado ? "nao" : "sim"} />
      <button className={`botao ${ligado ? "botao-neutro" : "botao-primario"}`} disabled={enviando}><Power /> {enviando ? "Salvando…" : ligado ? "Desligar envio automático" : "Ligar envio automático"}</button>
    </form>
  );
}

export function FormWhatsapp({ numeroId, modelo, comChave, ligado }: { numeroId: string | null; modelo: string | null; comChave: boolean; ligado: boolean }) {
  const [s, acao, enviando] = useActionState<Estado, FormData>(acaoSalvarWhatsapp, {});
  return (
    <form action={acao} className="grade-form config-form">
      <div className="c12"><Avisos erro={s.erro} ok={s.ok} /></div>
      <div className="campo c6"><label htmlFor="wz-num">Identificador do número</label><input id="wz-num" name="numeroId" className="entrada-texto num" inputMode="numeric" defaultValue={numeroId ?? ""} maxLength={30} placeholder="109876543210987" /></div>
      <div className="campo c6"><label htmlFor="wz-mod">Nome do modelo aprovado</label><input id="wz-mod" name="modelo" className="entrada-texto" defaultValue={modelo ?? ""} maxLength={120} placeholder="convite_cotacao" /></div>
      <div className="campo c12"><label htmlFor="wz-tok">Chave de acesso permanente</label><input id="wz-tok" name="token" type="password" className="entrada-texto" autoComplete="off" maxLength={600} placeholder={comChave ? "Guardada. Preencha só para trocar." : "Cole a chave gerada na Meta"} /></div>
      <label className="opcao-check c12"><input type="checkbox" name="ligado" defaultChecked={ligado} /> Enviar avisos de novas cotações pelo WhatsApp</label>
      <div className="c12 rodape-form"><button className="botao botao-neutro" disabled={enviando}><Save /> {enviando ? "Salvando…" : "Salvar"}</button></div>
    </form>
  );
}

export function FormTesteWhatsapp() {
  const [s, acao, enviando] = useActionState<Estado, FormData>(acaoTestarWhatsapp, {});
  return (
    <form action={acao} className="config-form config-codigo">
      <Avisos erro={s.erro} ok={s.ok} />
      <input name="numero" className="entrada-texto num" inputMode="tel" maxLength={20} required placeholder="(21) 99999-0000" aria-label="Celular para o teste" />
      <button className="botao botao-neutro" disabled={enviando}><Send /> {enviando ? "Enviando…" : "Enviar teste"}</button>
    </form>
  );
}
