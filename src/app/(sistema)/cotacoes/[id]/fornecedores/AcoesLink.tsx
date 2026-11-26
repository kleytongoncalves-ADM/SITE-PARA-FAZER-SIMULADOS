"use client";

import { useState } from "react";
import { Check, Copy, Mail, MessageCircle } from "lucide-react";

type Props = { caminho: string; fornecedor: string; orgao: string; titulo: string; prazo: string; email: string | null; telefone: string | null };

/** Link exclusivo do fornecedor: copiar, ou abrir e-mail e WhatsApp com a mensagem pronta. */
export function AcoesLink({ caminho, fornecedor, orgao, titulo, prazo, email, telefone }: Props) {
  const [copiado, setCopiado] = useState<"link" | "mensagem" | null>(null);
  const url = () => `${window.location.origin}${caminho}`;
  const mensagem = () => `Prezados,\n\n${orgao} solicita cotação de materiais: ${titulo}.\n\nPreencha os preços no link abaixo até ${prazo} (horário de Brasília). O link é exclusivo de ${fornecedor} e não exige cadastro.\n\n${url()}`;
  const copiar = async (o: "link" | "mensagem") => {
    try {
      await navigator.clipboard.writeText(o === "link" ? url() : mensagem());
      setCopiado(o);
      setTimeout(() => setCopiado(null), 1800);
    } catch { /* área de transferência bloqueada: o campo continua selecionável */ }
  };
  const fone = (telefone ?? "").replace(/\D/g, "");
  const zap = fone.length >= 10 ? (fone.length <= 11 ? `55${fone}` : fone) : "";
  return (
    <>
      <div className="cot-link">
        <input readOnly value={caminho} aria-label={`Link de ${fornecedor}`} onFocus={(e) => { e.currentTarget.value = url(); e.currentTarget.select(); }} />
        <button type="button" className="botao botao-primario botao-pequeno" onClick={() => copiar("link")}>{copiado === "link" ? <><Check /> Copiado</> : <><Copy /> Copiar link</>}</button>
      </div>
      <div className="cot-fornecedor-acoes" style={{ marginTop: 0, paddingTop: 0 }}>
        <button type="button" className="botao botao-neutro botao-pequeno" onClick={() => copiar("mensagem")}>{copiado === "mensagem" ? <><Check /> Copiada</> : <><Copy /> Copiar mensagem</>}</button>
        <button type="button" className="botao botao-neutro botao-pequeno" onClick={() => { window.location.href = `mailto:${email ?? ""}?subject=${encodeURIComponent(`Cotação de materiais: ${titulo}`)}&body=${encodeURIComponent(mensagem())}`; }}><Mail /> E-mail</button>
        <button type="button" className="botao botao-neutro botao-pequeno" onClick={() => window.open(`https://wa.me/${zap}?text=${encodeURIComponent(mensagem())}`, "_blank", "noopener")}><MessageCircle /> WhatsApp</button>
      </div>
    </>
  );
}
