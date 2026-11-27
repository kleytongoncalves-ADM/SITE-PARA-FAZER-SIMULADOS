import { LogOut } from "lucide-react";
import { acaoSairFornecedor } from "@/app/fornecedor/acoes";
import { LogoHorizontal } from "@/componentes/Logo";
import type { ResumoConvite } from "@/servicos/fornecedores";
import { FormEntradaFornecedor } from "./FormEntradaFornecedor";
import { ResumoCotacao } from "./ResumoCotacao";

type Props = {
  resumo: ResumoConvite | null;
  voltar: string;
  cadastro: string;
  /** Empresa convidada já tem acesso: o botão de cadastro sai do foco. */
  temConta?: boolean;
  aviso?: { titulo: string; texto: string; sair?: boolean } | null;
};

/** Tela de quem chega por um convite: resumo da cotação ao lado, entrada do fornecedor já escolhida. */
export function EntradaPeloConvite({ resumo, voltar, cadastro, temConta, aviso }: Props) {
  return (
    <main className="login">
      <div className={`vidro login-caixa entrada cadastro-caixa ${resumo ? "com-resumo" : ""}`}>
        <div className="cadastro-cabeca"><LogoHorizontal largura={190} /><span className="selo-fornecedor">Área do fornecedor</span></div>
        <div className="cadastro-grade">
          {resumo && <ResumoCotacao r={resumo} />}
          <div>
            {aviso ? (
              <>
                <h1 className="entrada-titulo">{aviso.titulo}</h1>
                <p className="entrada-sub">{aviso.texto}</p>
                {aviso.sair && <form action={acaoSairFornecedor}><button className="botao botao-neutro"><LogOut /> Sair e entrar com outra empresa</button></form>}
              </>
            ) : (
              <>
                <h1 className="entrada-titulo">{temConta ? "Entre para responder" : "Responda pela área do fornecedor"}</h1>
                <p className="entrada-sub">{temConta ? "A sua empresa já tem acesso. Entre e a cotação abre pronta para preencher." : "Cadastre a empresa uma vez e responda esta e as próximas cotações pelo mesmo acesso."}</p>
                <FormEntradaFornecedor voltar={voltar} cadastro={cadastro} />
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
