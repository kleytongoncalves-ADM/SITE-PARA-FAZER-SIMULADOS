import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { BotaoEnviar, FormAcao } from "@/componentes/FormAcao";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { pode } from "@/servicos/permissoes";
import { listarTabelas, obterComposicao, ROTULO_FONTE } from "@/servicos/precos";
import { acaoCriarComposicao } from "../../acoes";

export const metadata: Metadata = { title: "Nova composição própria" };

export default async function NovaComposicao({ searchParams }: { searchParams: Promise<{ origem?: string; tabela?: string }> }) {
  const q = await searchParams;
  const ator = comoAtor(await exigirUsuario());
  if (!pode(ator, "precos.composicao_propria")) {
    return <div className="cartao vazio"><b>Seu perfil não cria composições</b>Quem pode: direção e engenheiro responsável.</div>;
  }
  const tabelaId = q.tabela ?? (await listarTabelas(ator, { somenteLiberadas: true }))[0]?.id ?? "";
  const origem = q.origem && tabelaId ? await obterComposicao(ator, q.origem, tabelaId).catch(() => null) : null;

  return (
    <>
      <div className="cabecalho">
        <div>
          <div className="sobretitulo"><Link href="/precos?ver=proprias">Base de preços</Link><span>/</span><span>Nova composição</span></div>
          <h1 className="titulo">Nova composição própria</h1>
          {origem && <p className="subtitulo">A partir de {ROTULO_FONTE[origem.fonte]} {origem.codigo} · {origem.descricao}</p>}
        </div>
      </div>
      <FormAcao acao={acaoCriarComposicao.bind(null, tabelaId)} className="cartao grade-form" style={{ maxWidth: 860 }}>
        {origem && <input type="hidden" name="origemId" value={origem.id} />}
        <div className="campo c3"><label htmlFor="codigo">Código</label><input id="codigo" name="codigo" className="entrada-texto" required placeholder="CP-001" /></div>
        <div className="campo c7"><label htmlFor="descricao">Descrição</label><input id="descricao" name="descricao" className="entrada-texto" required defaultValue={origem?.descricao} /></div>
        <div className="campo c2"><label htmlFor="unidade">Unidade</label><input id="unidade" name="unidade" className="entrada-texto" required defaultValue={origem?.unidade} /></div>
        <div className="campo c12">
          <label htmlFor="justificativa">Justificativa técnica</label>
          <textarea id="justificativa" name="justificativa" className="entrada-texto" rows={4} required placeholder="Por que a composição oficial não atende e qual a fonte dos coeficientes" />
        </div>
        <div className="c12 rodape-form">
          <Link href="/precos?ver=proprias" className="botao botao-texto">Cancelar</Link>
          <BotaoEnviar enviando="Criando…"><Plus /> Criar composição</BotaoEnviar>
        </div>
      </FormAcao>
    </>
  );
}
