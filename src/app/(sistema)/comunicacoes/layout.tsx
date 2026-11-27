import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { SemAcesso } from "@/componentes/SemAcesso";
import { naoLidasDoOrgao } from "@/servicos/comunicacao";
import { pode } from "@/servicos/permissoes";
import { AbasComunicacao } from "./AbasComunicacao";
import "@/estilos/fornecedores.css";

export default async function LayoutComunicacoes({ children }: { children: React.ReactNode }) {
  const a = comoAtor(await exigirUsuario());
  if (!pode(a, "cotacao.ver")) return <SemAcesso modulo="as comunicações com fornecedores" />;
  const naoLidas = await naoLidasDoOrgao(a);
  return (
    <>
      <div className="cabecalho">
        <div>
          <div className="sobretitulo">Fornecedores</div>
          <h1 className="titulo">Comunicações</h1>
          <p className="subtitulo">Conversas, contatos e o histórico de e-mails e mensagens com os fornecedores.</p>
        </div>
      </div>
      <AbasComunicacao naoLidas={naoLidas} configurar={pode(a, "usuario.gerenciar")} />
      {children}
    </>
  );
}
