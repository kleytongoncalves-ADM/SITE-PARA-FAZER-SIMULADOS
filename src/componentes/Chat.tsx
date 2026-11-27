"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import type { MensagemChat } from "@/servicos/comunicacao";

const hora = (d: Date | string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(new Date(d));
const dia = (d: Date | string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(new Date(d));

type Props = {
  mensagens: MensagemChat[];
  podeEscrever: boolean;
  semPermissao?: string;
  enviar: (texto: string) => Promise<{ erro?: string } | void>;
  vazio: string;
};

/** Conversa no estilo de aplicativo de mensagens: atualiza sozinha a cada poucos segundos. */
export function Chat({ mensagens, podeEscrever, semPermissao, enviar, vazio }: Props) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string>();
  const [ocupado, iniciar] = useTransition();
  const fim = useRef<HTMLDivElement>(null);
  const ultima = mensagens.at(-1)?.id;

  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, 8000);
    return () => clearInterval(t);
  }, [router]);
  useEffect(() => { fim.current?.scrollIntoView({ block: "end" }); }, [ultima]);

  function mandar() {
    const t = texto.trim();
    if (!t || ocupado) return;
    setErro(undefined);
    iniciar(async () => {
      const r = await enviar(t);
      if (r && r.erro) return setErro(r.erro);
      setTexto("");
      router.refresh();
    });
  }

  const dias = mensagens.map((m) => dia(m.criadaEm));
  return (
    <div className="chat">
      <div className="chat-mensagens" role="log" aria-live="polite" aria-label="Mensagens">
        {mensagens.length === 0 && <div className="chat-vazio">{vazio}</div>}
        {mensagens.map((m, i) => {
          const d = dias[i];
          const separador = i === 0 || d !== dias[i - 1];
          return (
            <div key={m.id} className="chat-linha-grupo">
              {separador && <div className="chat-dia"><span>{d}</span></div>}
              <div className={`chat-linha ${m.minha ? "minha" : ""} ${m.autor}`}>
                <div className="chat-balao">
                  {!m.minha && <b className="chat-autor">{m.autorNome}</b>}
                  <p>{m.texto}</p>
                  <time dateTime={new Date(m.criadaEm).toISOString()}>{m.minha ? `Você · ${hora(m.criadaEm)}` : hora(m.criadaEm)}</time>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={fim} />
      </div>
      {podeEscrever ? (
        <form className="chat-escrever" onSubmit={(e) => { e.preventDefault(); mandar(); }}>
          <textarea
            className="entrada-texto" rows={2} maxLength={4000} value={texto} placeholder="Escreva uma mensagem" aria-label="Mensagem"
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); mandar(); } }}
          />
          <button className="botao botao-primario" disabled={ocupado || !texto.trim()} aria-label="Enviar mensagem"><Send /> {ocupado ? "Enviando…" : "Enviar"}</button>
          {erro && <span className="erro" role="alert">{erro}</span>}
        </form>
      ) : (
        <p className="chat-sem-permissao">{semPermissao ?? "Seu perfil pode ler, mas não enviar mensagens."}</p>
      )}
    </div>
  );
}
