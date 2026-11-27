import type { Metadata } from "next";
import { exigirFornecedor } from "@/lib/sessao";
import { formatarCnpj } from "@/servicos/contratos";
import { minhaEmpresa } from "@/servicos/fornecedores";
import { whatsappConfigurado } from "@/servicos/whatsapp";
import { FormAvisos, FormDadosEmpresa, FormExperiencia, FormSenha, ListaExperiencias } from "./Formularios";

export const metadata: Metadata = { title: "Minha empresa · Fornecedor" };

export default async function MinhaEmpresa() {
  const f = await exigirFornecedor();
  const e = await minhaEmpresa(f);
  const h = e.historico;
  return (
    <div className="grade">
      <div>
        <div className="sobretitulo">Área do fornecedor</div>
        <h1 className="titulo">Minha empresa</h1>
        <p className="subtitulo">CNPJ <b className="num">{formatarCnpj(e.cnpj)}</b> · cadastro desde {new Date(e.desde).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
      </div>

      <section className="cartao">
        <h2 className="cartao-titulo">Histórico na plataforma</h2>
        <p className="cartao-sub">Números do sistema, em todos os órgãos. Os órgãos que convidam a sua empresa veem este resumo.</p>
        <div className="forn-numeros">
          <div><b className="num">{h.recebidas}</b><span>Cotações recebidas</span></div>
          <div><b className="num">{h.respondidas}</b><span>Respondidas</span></div>
          <div><b className="num">{h.ganhas}</b><span>Com itens ganhos</span></div>
          <div><b className="num">{h.noPrazo == null ? "—" : `${h.noPrazo}%`}</b><span>{h.entregas ? `Entregas no prazo (${h.entregas})` : "Entregas no prazo"}</span></div>
        </div>
      </section>

      <section className="cartao">
        <h2 className="cartao-titulo">Experiência declarada</h2>
        <p className="cartao-sub">Fornecimentos e serviços que a empresa já fez. Aparecem para os órgãos marcados como &quot;Declarado&quot;.</p>
        <ListaExperiencias itens={e.experiencias} />
        <FormExperiencia />
      </section>

      <div className="forn-colunas">
        <section className="cartao"><h2 className="cartao-titulo">Dados da empresa e do acesso</h2><FormDadosEmpresa e={e} /></section>
        <div className="grade">
          <section className="cartao"><h2 className="cartao-titulo">Avisos de novas cotações</h2><FormAvisos e={e} whatsappAtivo={whatsappConfigurado()} /></section>
          <section className="cartao"><h2 className="cartao-titulo">Senha</h2><FormSenha /></section>
        </div>
      </div>
    </div>
  );
}
