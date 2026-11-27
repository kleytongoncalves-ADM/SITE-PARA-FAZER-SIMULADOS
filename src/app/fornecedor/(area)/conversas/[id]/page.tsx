import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Landmark, Send } from "lucide-react";
import { ListaConversas } from "@/app/(sistema)/comunicacoes/ListaConversas";
import { Chat } from "@/componentes/Chat";
import { exigirFornecedor } from "@/lib/sessao";
import { conversaDoFornecedor, conversasDoFornecedor } from "@/servicos/comunicacao";
import { conviteDaContaNaSolicitacao } from "@/servicos/fornecedores";
import { acaoMensagemFornecedor } from "../../../acoes";

export const metadata: Metadata = { title: "Conversa · Fornecedor" };
export const dynamic = "force-dynamic";

export default async function ConversaFornecedor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const f = await exigirFornecedor();
  const c = await conversaDoFornecedor(f, id);
  if (!c) notFound();
  const conversas = await conversasDoFornecedor(f);
  const conviteDaCotacao = c.solicitacaoId ? await conviteDaContaNaSolicitacao(f.contaId, c.solicitacaoId) : null;
  return (
    <div className="grade">
      <div><div className="sobretitulo">Área do fornecedor</div><h1 className="titulo">Conversas</h1></div>
      <div className="conversas-tela com-aberta">
        <section className="cartao conversas-coluna"><ListaConversas itens={conversas} base="/fornecedor/conversas" ativa={id} titulo={(x) => x.orgao ?? ""} /></section>
        <section className="cartao conversa-painel">
          <header className="conversa-cabeca">
            <Link href="/fornecedor/conversas" className="redondo so-celular" aria-label="Voltar às conversas"><ArrowLeft /></Link>
            <div style={{ minWidth: 0 }}>
              <b><Landmark size={15} style={{ verticalAlign: "-2px" }} /> {c.orgao}</b>
              {conviteDaCotacao
                ? <Link href={`/fornecedor/cotacoes/${conviteDaCotacao}`} className="conversa-cotacao"><Send /> Cotação {c.cotacao}</Link>
                : <span className="conversa-cotacao">{c.cotacao ? `Cotação ${c.cotacao}` : "Conversa geral"}</span>}
            </div>
          </header>
          <Chat mensagens={c.mensagens} podeEscrever={c.podeEscrever} enviar={acaoMensagemFornecedor.bind(null, id)}
            semPermissao="Seu usuário é só de consulta. Peça ao administrador da empresa para mudar a permissão."
            vazio={`Escreva para ${c.orgao}. A equipe vê a mensagem em Comunicações.`} />
        </section>
      </div>
    </div>
  );
}
