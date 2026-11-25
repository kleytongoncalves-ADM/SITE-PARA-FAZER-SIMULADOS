import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { BotaoEnviar, FormAcao } from "@/componentes/FormAcao";
import { mesAno } from "@/lib/formato";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { ROTULO_TIPO_BDI, TIPOS_OBRA_BDI } from "@/servicos/calculo";
import { listarObras } from "@/servicos/obras";
import { pode } from "@/servicos/permissoes";
import { listarTabelas, ROTULO_FONTE, ROTULO_REGIME } from "@/servicos/precos";
import { acaoCriarOrcamento } from "../acoes";

export const metadata: Metadata = { title: "Novo orçamento" };

export default async function NovoOrcamento({ searchParams }: { searchParams: Promise<{ obra?: string }> }) {
  const { obra } = await searchParams;
  const ator = comoAtor(await exigirUsuario());
  if (!pode(ator, "orcamento.editar")) {
    return <div className="cartao vazio"><b>Seu perfil não elabora orçamentos</b>Quem pode: direção e engenheiro responsável.</div>;
  }
  const [obras, tabelas] = await Promise.all([listarObras(ator), listarTabelas(ator, { somenteLiberadas: true })]);
  const abertas = obras.filter((o) => !["concluida", "recebida_provisoriamente", "recebida_definitivamente", "cancelada"].includes(o.situacao));

  return (
    <>
      <div className="cabecalho">
        <div>
          <div className="sobretitulo"><Link href="/orcamentos">Orçamentos</Link><span>/</span><span>Novo</span></div>
          <h1 className="titulo">Novo orçamento</h1>
        </div>
      </div>
      {abertas.length === 0 ? (
        <div className="cartao vazio"><b>Nenhuma obra disponível</b><Link href="/obras/nova" className="botao botao-texto">Cadastrar obra</Link></div>
      ) : tabelas.length === 0 ? (
        <div className="cartao vazio"><b>Nenhuma base de preços liberada</b><Link href="/precos" className="botao botao-texto">Ver base de preços</Link></div>
      ) : (
        <FormAcao acao={acaoCriarOrcamento} className="cartao grade-form" style={{ maxWidth: 860 }}>
          <div className="campo c12">
            <label htmlFor="obraId">Obra</label>
            <select id="obraId" name="obraId" className="entrada-texto" defaultValue={obra} required>
              {abertas.map((o) => <option key={o.id} value={o.id}>{o.codigo} · {o.nome}</option>)}
            </select>
          </div>
          <div className="campo c12">
            <label htmlFor="nome">Nome</label>
            <input id="nome" name="nome" className="entrada-texto" required defaultValue="Orçamento básico" />
          </div>
          <div className="campo c6">
            <label htmlFor="tabelaId">Base de preços</label>
            <select id="tabelaId" name="tabelaId" className="entrada-texto" required>
              {tabelas.map((t) => <option key={t.id} value={t.id}>{ROTULO_FONTE[t.fonte]} {t.uf} {mesAno(t.mes)} · {ROTULO_REGIME[t.regime]}</option>)}
            </select>
          </div>
          <div className="campo c3">
            <label htmlFor="arredondamento">Totais</label>
            <select id="arredondamento" name="arredondamento" className="entrada-texto" defaultValue="">
              <option value="">Padrão do órgão</option><option value="arredondar">Arredondar</option><option value="truncar">Truncar</option>
            </select>
          </div>
          <div className="campo c3">
            <label htmlFor="tipoObraBdi">Tipo de obra (BDI)</label>
            <select id="tipoObraBdi" name="tipoObraBdi" className="entrada-texto" defaultValue="">
              <option value="">Conforme a obra</option>
              {TIPOS_OBRA_BDI.filter((t) => t !== "fornecimento").map((t) => <option key={t} value={t}>{ROTULO_TIPO_BDI[t]}</option>)}
            </select>
          </div>
          <div className="c12 rodape-form">
            <Link href="/orcamentos" className="botao botao-texto">Cancelar</Link>
            <BotaoEnviar enviando="Criando…"><Plus /> Criar orçamento</BotaoEnviar>
          </div>
        </FormAcao>
      )}
    </>
  );
}
