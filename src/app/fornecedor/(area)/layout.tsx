import { CascaFornecedor } from "@/componentes/fornecedor/CascaFornecedor";
import { exigirFornecedor } from "@/lib/sessao";
import { cotacoesDoFornecedor, naoLidas } from "@/servicos/fornecedores";
import { naoLidasDoFornecedor } from "@/servicos/comunicacao";
import "@/estilos/cotacoes.css";
import "@/estilos/fornecedores.css";

export const dynamic = "force-dynamic";

export default async function LayoutFornecedor({ children }: { children: React.ReactNode }) {
  const f = await exigirFornecedor();
  const [n, lista, conversas] = await Promise.all([naoLidas(f), cotacoesDoFornecedor(f), naoLidasDoFornecedor(f)]);
  const pendentes = lista.filter((c) => c.estado === "pendente" || c.estado === "rascunho").length;
  return <CascaFornecedor nome={f.nome} empresa={f.nomeFantasia ?? f.razaoSocial} naoLidas={n} conversas={conversas} pendentes={pendentes}>{children}</CascaFornecedor>;
}
