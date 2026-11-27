import type { Metadata } from "next";
import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { conversasDoOrgao } from "@/servicos/comunicacao";
import { ListaConversas } from "./ListaConversas";

export const metadata: Metadata = { title: "Comunicações" };
export const dynamic = "force-dynamic";

export default async function Conversas() {
  const a = comoAtor(await exigirUsuario());
  const conversas = await conversasDoOrgao(a);
  return (
    <div className="conversas-tela">
      <section className="cartao conversas-coluna">
        {conversas.length ? <ListaConversas itens={conversas} base="/comunicacoes/conversas" /> : (
          <div className="vazio"><b>Nenhuma conversa</b>Comece pelo botão Chat de um fornecedor na cotação ou em <Link href="/comunicacoes/contatos">Contatos</Link>.</div>
        )}
      </section>
      <section className="cartao conversa-painel conversa-painel-vazio">
        <MessagesSquare />
        <b>Escolha uma conversa</b>
        <p className="fraco">O chat funciona com fornecedores cadastrados na área do fornecedor. Cada conversa fica ligada à empresa e, quando for o caso, à cotação.</p>
      </section>
    </div>
  );
}
