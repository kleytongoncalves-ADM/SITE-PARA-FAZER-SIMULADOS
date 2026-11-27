import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, MessageCircle, Send } from "lucide-react";
import { Chat } from "@/componentes/Chat";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { formatarCnpj } from "@/servicos/contratos";
import { conversaDoOrgao, conversasDoOrgao } from "@/servicos/comunicacao";
import { numeroWhatsapp } from "@/servicos/whatsapp";
import { acaoEnviarMensagem } from "../../acoes";
import { ListaConversas } from "../../ListaConversas";

export const metadata: Metadata = { title: "Conversa · Comunicações" };
export const dynamic = "force-dynamic";

export default async function ConversaContratante({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = comoAtor(await exigirUsuario());
  const c = await conversaDoOrgao(a, id);
  if (!c) notFound();
  const conversas = await conversasDoOrgao(a);
  const zap = numeroWhatsapp(c.telefone);
  return (
    <div className="conversas-tela com-aberta">
      <section className="cartao conversas-coluna"><ListaConversas itens={conversas} base="/comunicacoes/conversas" ativa={id} /></section>
      <section className="cartao conversa-painel">
        <header className="conversa-cabeca">
          <Link href="/comunicacoes" className="redondo so-celular" aria-label="Voltar às conversas"><ArrowLeft /></Link>
          <div style={{ minWidth: 0 }}>
            <b>{c.fornecedor}</b>
            <span className="fraco num">CNPJ {formatarCnpj(c.cnpj)}</span>
            {c.solicitacaoId
              ? <Link href={`/cotacoes/${c.solicitacaoId}/fornecedores`} className="conversa-cotacao"><Send /> Cotação {c.cotacao}</Link>
              : <span className="conversa-cotacao">Conversa geral</span>}
          </div>
          <span style={{ flex: 1 }} />
          {c.email && <a className="botao botao-neutro botao-pequeno" href={`mailto:${c.email}`}><Mail /> E-mail</a>}
          {zap && <a className="botao botao-neutro botao-pequeno" href={`https://wa.me/${zap}`} target="_blank" rel="noopener noreferrer"><MessageCircle /> WhatsApp</a>}
        </header>
        <Chat mensagens={c.mensagens} podeEscrever={c.podeEscrever} enviar={acaoEnviarMensagem.bind(null, id)}
          vazio={`Escreva a primeira mensagem para ${c.fornecedor}. A empresa vê a conversa na área do fornecedor.`} />
      </section>
    </div>
  );
}
