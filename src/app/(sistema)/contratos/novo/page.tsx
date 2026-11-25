import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { BotaoEnviar, FormAcao } from "@/componentes/FormAcao";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { listarEmpresas, orcamentosParaContratar, pessoasDesignaveis } from "@/servicos/contratos";
import { pode } from "@/servicos/permissoes";
import { acaoCriarContrato } from "../acoes";
import { CamposContrato } from "../CamposContrato";

export const metadata: Metadata = { title: "Novo contrato" };

export default async function NovoContrato({ searchParams }: { searchParams: Promise<{ orcamento?: string }> }) {
  const { orcamento } = await searchParams;
  const ator = comoAtor(await exigirUsuario());
  if (!pode(ator, "contrato.editar")) {
    return <div className="cartao vazio"><b>Seu perfil não cadastra contratos</b>Quem pode: direção, gestor de contrato e administrativo.</div>;
  }
  const [orcamentos, empresas, pessoas] = await Promise.all([orcamentosParaContratar(ator), listarEmpresas(ator), pessoasDesignaveis(ator)]);
  const escolhido = orcamentos.find((o) => o.id === orcamento) ?? orcamentos[0];

  return (
    <>
      <div className="cabecalho">
        <div>
          <div className="sobretitulo"><Link href="/contratos">Contratos</Link><span>/</span><span>Novo</span></div>
          <h1 className="titulo">Novo contrato</h1>
        </div>
      </div>
      {orcamentos.length === 0 ? (
        <div className="cartao vazio"><b>Nenhum orçamento aprovado sem contrato</b><Link href="/orcamentos" className="botao botao-texto">Ver orçamentos</Link></div>
      ) : (
        <FormAcao acao={acaoCriarContrato} className="cartao grade-form" style={{ maxWidth: 980 }}>
          <div className="campo c12">
            <label htmlFor="orcamentoId">Orçamento aprovado</label>
            <select id="orcamentoId" name="orcamentoId" className="entrada-texto" defaultValue={escolhido?.id} required>
              {orcamentos.map((o) => <option key={o.id} value={o.id}>{o.obraCodigo} · {o.obraNome} · {o.rotulo} {o.nome}</option>)}
            </select>
          </div>
          <CamposContrato empresas={empresas} pessoas={pessoas} sugestao={{
            objeto: escolhido?.obraNome,
            regime: escolhido?.formaExecucao === "direta" ? "direta" : "preco_unitario",
            natureza: escolhido?.tipoObra === "reforma" ? "reforma" : "obra_nova",
          }} />
          <div className="c12 rodape-form">
            {empresas.length === 0 && <Link href="/contratos/empresas" className="botao botao-texto">Cadastrar empresa</Link>}
            <Link href="/contratos" className="botao botao-texto">Cancelar</Link>
            <BotaoEnviar enviando="Gerando planilha…"><Plus /> Cadastrar contrato</BotaoEnviar>
          </div>
        </FormAcao>
      )}
    </>
  );
}
