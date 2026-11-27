"use client";

import { useState } from "react";
import { Check, Copy, Mail, MessageCircle, MessagesSquare } from "lucide-react";
import { acaoConversarComConvidado, acaoRegistrarAbertura } from "../../acoes";

type Props = {
  caminho: string; fornecedor: string; orgao: string; titulo: string; prazo: string; email: string | null; telefone: string | null;
  /** Obra, itens e local de entrega, já escritos para a mensagem. */
  detalhes: string; conviteId: string; solicitacaoId: string; empresaId: string;
  /** Empresa com cadastro na área do fornecedor: o chat interno fica disponível. */
  chat: boolean;
};

/** Link exclusivo do fornecedor: copiar, ou abrir e-mail e WhatsApp com a mensagem pronta. */
export function AcoesLink({ caminho, fornecedor, orgao, titulo, prazo, email, telefone, detalhes, conviteId, solicitacaoId, empresaId, chat }: Props) {
  const [copiado, setCopiado] = useState<"link" | "mensagem" | null>(null);
  const [erro, setErro] = useState<string>();
  const [abrindo, setAbrindo] = useState(false);
  const url = () => `${window.location.origin}${caminho}`;
  const mensagem = () => `Prezados,\n\n${orgao} solicita cotação de materiais: ${titulo}.\n${detalhes}\n\nResponda pelo link abaixo até ${prazo} (horário de Brasília). No primeiro acesso, cadastre a empresa; depois, a cotação abre pronta para preencher. O link é exclusivo de ${fornecedor}.\n\n${url()}`;
  const copiar = async (o: "link" | "mensagem") => {
    try {
      await navigator.clipboard.writeText(o === "link" ? url() : mensagem());
      setCopiado(o);
      setTimeout(() => setCopiado(null), 1800);
    } catch { /* área de transferência bloqueada: o campo continua selecionável */ }
  };
  const assunto = `Cotação de materiais: ${titulo}`;
  const abrirEmail = () => {
    void acaoRegistrarAbertura(conviteId, "email", email ?? "", assunto);
    window.location.href = `mailto:${email ?? ""}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(mensagem())}`;
  };
  const abrirWhatsapp = () => {
    void acaoRegistrarAbertura(conviteId, "whatsapp", telefone ?? "", assunto);
    window.open(`https://wa.me/${zap}?text=${encodeURIComponent(mensagem())}`, "_blank", "noopener");
  };
  const conversar = async () => {
    setAbrindo(true);
    const r = await acaoConversarComConvidado(solicitacaoId, empresaId);
    if (r?.erro) { setErro(r.erro); setAbrindo(false); }
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
        <button type="button" className="botao botao-neutro botao-pequeno" onClick={abrirEmail} title={email ? `Abrir o seu e-mail para ${email}` : "Abrir o seu e-mail"}><Mail /> E-mail</button>
        <button type="button" className="botao botao-neutro botao-pequeno" onClick={abrirWhatsapp} title={zap ? `Abrir conversa com ${telefone}` : "Abrir o WhatsApp"}><MessageCircle /> WhatsApp</button>
        {chat && <button type="button" className="botao botao-neutro botao-pequeno" onClick={conversar} disabled={abrindo}><MessagesSquare /> {abrindo ? "Abrindo…" : "Chat"}</button>}
      </div>
      {erro && <span className="erro" role="alert">{erro}</span>}
    </>
  );
}
