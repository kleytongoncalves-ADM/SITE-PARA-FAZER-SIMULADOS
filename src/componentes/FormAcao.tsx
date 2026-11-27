"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Avisos } from "./Avisos";

type Estado = { erro?: string; ok?: string };

type Props = {
  acao: (estado: Estado, f: FormData) => Promise<Estado>;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** Pergunta antes de enviar (ações que não se desfazem). */
  confirmar?: string;
  /** Mostra a mensagem de sucesso. Formulários pequenos mostram só o erro. */
  mostrarOk?: boolean;
  /** Limpa os campos depois de enviar com sucesso. */
  limpar?: boolean;
};

export function FormAcao({ acao, children, className, style, confirmar, mostrarOk = true, limpar }: Props) {
  const [estado, enviar] = useActionState<Estado, FormData>(acao, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (limpar && estado.ok) ref.current?.reset();
  }, [estado, limpar]);
  return (
    <form
      ref={ref}
      action={enviar}
      className={className}
      style={style}
      onSubmit={(e) => { if (confirmar && !window.confirm(confirmar)) e.preventDefault(); }}
    >
      <Avisos erro={estado.erro} ok={mostrarOk ? estado.ok : undefined} />
      {children}
    </form>
  );
}

export function BotaoEnviar({ children, enviando, className = "botao botao-primario", name, value, title, ariaLabel, confirmar }: {
  children: React.ReactNode; enviando?: string; className?: string; name?: string; value?: string; title?: string; ariaLabel?: string;
  /** Pergunta antes de enviar, para ações que não têm volta. */
  confirmar?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button className={className} disabled={pending} name={name} value={value} title={title} aria-label={ariaLabel}
      onClick={confirmar ? (e) => { if (e.currentTarget.form?.checkValidity() !== false && !window.confirm(confirmar)) e.preventDefault(); } : undefined}>
      {pending && enviando ? enviando : children}
    </button>
  );
}
