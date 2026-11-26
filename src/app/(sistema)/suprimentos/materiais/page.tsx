import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Plus, Save, Search } from "lucide-react";
import { BotaoEnviar, FormAcao } from "@/componentes/FormAcao";
import { numero } from "@/lib/formato";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { pode } from "@/servicos/permissoes";
import { listarMateriais } from "@/servicos/suprimentos";
import { acaoSalvarMaterial } from "../acoes";

export const metadata: Metadata = { title: "Materiais" };

export default async function Materiais({ searchParams }: { searchParams: Promise<{ busca?: string }> }) {
  const { busca } = await searchParams;
  const ator = comoAtor(await exigirUsuario());
  if (!pode(ator, "suprimentos.ver")) return <div className="cartao vazio"><b>Seu perfil não acessa os suprimentos</b></div>;
  const materiais = await listarMateriais(ator, busca);
  const editar = pode(ator, "suprimentos.comprar");
  return (
    <>
      <div className="cabecalho">
        <div><div className="sobretitulo"><Link href="/suprimentos">Suprimentos</Link></div><h1 className="titulo">Materiais</h1></div>
        <Link href="/suprimentos" className="botao botao-neutro"><ArrowLeft /> Suprimentos</Link>
      </div>
      <div className="grade">
        <form className="form-linha" action="/suprimentos/materiais">
          <input name="busca" defaultValue={busca ?? ""} className="entrada-texto" placeholder="Descrição ou código" aria-label="Buscar material" style={{ flex: 1, minWidth: 200 }} />
          <button className="botao botao-neutro"><Search /> Buscar</button>
        </form>
        {editar && (
          <details className="detalhe-acao">
            <summary>Novo material</summary>
            <FormAcao acao={acaoSalvarMaterial.bind(null, null)} className="grade-form" style={{ marginTop: 10 }} limpar>
              <div className="campo c2"><label htmlFor="mt-c">Código</label><input id="mt-c" name="codigo" className="entrada-texto" /></div>
              <div className="campo c6"><label htmlFor="mt-d">Descrição</label><input id="mt-d" name="descricao" className="entrada-texto" required /></div>
              <div className="campo c2"><label htmlFor="mt-u">Unidade</label><input id="mt-u" name="unidade" className="entrada-texto" required /></div>
              <div className="campo c2"><label htmlFor="mt-p">Perda prevista (%)</label><input id="mt-p" name="perdaPrevista" inputMode="decimal" defaultValue="5" className="entrada-texto num" /></div>
              <div className="campo c6"><label htmlFor="mt-g">Grupo</label><input id="mt-g" name="grupo" className="entrada-texto" placeholder="Agregados, cimento, aço…" /></div>
              <div className="c6 rodape-form" style={{ alignSelf: "end" }}><BotaoEnviar enviando="Incluindo…"><Plus /> Incluir material</BotaoEnviar></div>
            </FormAcao>
          </details>
        )}
        {materiais.length === 0 ? <div className="cartao vazio"><b>Nenhum material</b></div> : (
          <div className="tabela-caixa">
            <table className="tabela tabela-compacta">
              <thead>{editar ? (
                <tr><th>Código</th><th colSpan={6}><div className="linha-material linha-material-cabecalho"><span>Descrição</span><span>Unidade</span><span>Grupo</span><span className="dir">Perda (%)</span><span>Situação</span><span /></div></th></tr>
              ) : (
                <tr><th>Código</th><th>Descrição</th><th>Unidade</th><th>Grupo</th><th className="dir">Perda prevista</th><th className="dir">Obras</th></tr>
              )}</thead>
              <tbody>{materiais.map((m) => (
                <tr key={m.id} className={m.ativo ? "" : "linha-apagada"}>
                  <td className="num">{m.codigo ?? "—"}</td>
                  {editar ? (
                    <td colSpan={6}>
                      <FormAcao acao={acaoSalvarMaterial.bind(null, m.id)} className="linha-material" mostrarOk={false}>
                        <input name="codigo" type="hidden" value={m.codigo ?? ""} />
                        <input name="descricao" defaultValue={m.descricao} className="entrada-texto" aria-label="Descrição" required />
                        <input name="unidade" defaultValue={m.unidade} className="entrada-texto" aria-label="Unidade" required />
                        <input name="grupo" defaultValue={m.grupo ?? ""} className="entrada-texto" aria-label="Grupo" />
                        <input name="perdaPrevista" defaultValue={String(m.perdaPrevista).replace(".", ",")} className="entrada-texto num" aria-label="Perda prevista" />
                        <label className="opcao-check"><input type="checkbox" name="ativo" value="sim" defaultChecked={m.ativo} /> Ativo</label>
                        <BotaoEnviar className="botao botao-neutro botao-pequeno" ariaLabel="Salvar"><Save /></BotaoEnviar>
                      </FormAcao>
                    </td>
                  ) : <>
                    <td>{m.descricao}</td><td>{m.unidade}</td><td>{m.grupo ?? "—"}</td><td className="dir num">{numero(m.perdaPrevista, 1)}%</td><td className="dir num">{m.obras || "—"}</td>
                  </>}
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
