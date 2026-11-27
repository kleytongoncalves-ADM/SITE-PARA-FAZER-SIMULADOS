import type { Metadata } from "next";
import { MessagesSquare } from "lucide-react";
import { ListaConversas } from "@/app/(sistema)/comunicacoes/ListaConversas";
import { exigirFornecedor } from "@/lib/sessao";
import { conversasDoFornecedor } from "@/servicos/comunicacao";

export const metadata: Metadata = { title: "Conversas · Fornecedor" };
export const dynamic = "force-dynamic";

export default async function ConversasFornecedor() {
  const f = await exigirFornecedor();
  const conversas = await conversasDoFornecedor(f);
  return (
    <div className="grade">
      <div><div className="sobretitulo">Área do fornecedor</div><h1 className="titulo">Conversas</h1></div>
      <div className="conversas-tela">
        <section className="cartao conversas-coluna">
          {conversas.length ? <ListaConversas itens={conversas} base="/fornecedor/conversas" titulo={(c) => c.orgao ?? ""} /> : (
            <div className="vazio"><b>Nenhuma conversa</b>Quando um contratante escrever, a conversa aparece aqui. Você também pode abrir uma conversa pela página da cotação.</div>
          )}
        </section>
        <section className="cartao conversa-painel conversa-painel-vazio">
          <MessagesSquare />
          <b>Escolha uma conversa</b>
          <p className="fraco">Converse com quem pediu a cotação sem sair do sistema.</p>
        </section>
      </div>
    </div>
  );
}
