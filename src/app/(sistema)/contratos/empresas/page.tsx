import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Save } from "lucide-react";
import { BotaoEnviar, FormAcao } from "@/componentes/FormAcao";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { formatarCnpj, listarEmpresas, ROTULO_TIPO_EMPRESA, type Empresa, type TipoEmpresa } from "@/servicos/contratos";
import { pode } from "@/servicos/permissoes";
import { acaoEmpresa } from "../acoes";

export const metadata: Metadata = { title: "Empresas" };

function Campos({ e }: { e?: Empresa }) {
  const s = e?.id.slice(0, 8) ?? "nova";
  return (
    <>
      <div className="campo c6"><label htmlFor={`rs-${s}`}>Razão social</label><input id={`rs-${s}`} name="razaoSocial" className="entrada-texto" required defaultValue={e?.razaoSocial} /></div>
      <div className="campo c3"><label htmlFor={`cnpj-${s}`}>CNPJ</label><input id={`cnpj-${s}`} name="cnpj" className="entrada-texto num" required inputMode="numeric" defaultValue={e ? formatarCnpj(e.cnpj) : ""} placeholder="00.000.000/0000-00" /></div>
      <div className="campo c3"><label htmlFor={`tipo-${s}`}>Tipo</label>
        <select id={`tipo-${s}`} name="tipo" className="entrada-texto" defaultValue={e?.tipo ?? "contratada"}>
          {(Object.keys(ROTULO_TIPO_EMPRESA) as TipoEmpresa[]).map((t) => <option key={t} value={t}>{ROTULO_TIPO_EMPRESA[t]}</option>)}
        </select>
      </div>
      <div className="campo c4"><label htmlFor={`resp-${s}`}>Responsável</label><input id={`resp-${s}`} name="responsavel" className="entrada-texto" defaultValue={e?.responsavel ?? ""} /></div>
      <div className="campo c4"><label htmlFor={`email-${s}`}>E-mail</label><input id={`email-${s}`} name="email" type="email" className="entrada-texto" defaultValue={e?.email ?? ""} /></div>
      <div className="campo c4"><label htmlFor={`tel-${s}`}>Telefone</label><input id={`tel-${s}`} name="telefone" className="entrada-texto" defaultValue={e?.telefone ?? ""} /></div>
    </>
  );
}

export default async function Empresas({ searchParams }: { searchParams: Promise<{ editar?: string }> }) {
  const { editar } = await searchParams;
  const ator = comoAtor(await exigirUsuario());
  if (!pode(ator, "contrato.ver")) {
    return <div className="cartao vazio"><b>Seu perfil não acessa contratos</b></div>;
  }
  const empresas = await listarEmpresas(ator);
  const podeEditar = pode(ator, "contrato.editar");
  const emEdicao = podeEditar ? empresas.find((e) => e.id === editar) : undefined;

  return (
    <>
      <div className="cabecalho">
        <div>
          <div className="sobretitulo"><Link href="/contratos">Contratos</Link><span>/</span><span>Empresas</span></div>
          <h1 className="titulo">Empresas</h1>
        </div>
      </div>
      <div className="grade">
        {podeEditar && (
          <section className="cartao surgir">
            <h2 className="cartao-titulo">{emEdicao ? `Editar ${emEdicao.razaoSocial}` : "Nova empresa"}</h2>
            <FormAcao key={emEdicao?.id ?? "nova"} acao={acaoEmpresa.bind(null, emEdicao?.id ?? null)} className="grade-form" style={{ marginTop: 14 }} limpar={!emEdicao}>
              <Campos e={emEdicao} />
              <div className="c12 rodape-form">
                {emEdicao && <Link href="/contratos/empresas" className="botao botao-texto">Cancelar</Link>}
                <BotaoEnviar enviando="Salvando…">{emEdicao ? <><Save /> Salvar</> : <><Plus /> Cadastrar</>}</BotaoEnviar>
              </div>
            </FormAcao>
          </section>
        )}
        {empresas.length === 0 ? <div className="cartao vazio"><b>Nenhuma empresa cadastrada</b></div> : (
          <div className="tabela-caixa surgir">
            <table className="tabela">
              <thead><tr><th>Razão social</th><th>CNPJ</th><th>Tipo</th><th>Contato</th><th className="dir">Contratos</th>{podeEditar && <th />}</tr></thead>
              <tbody>
                {empresas.map((e) => (
                  <tr key={e.id}>
                    <td className="forte">{e.razaoSocial}</td>
                    <td className="num">{formatarCnpj(e.cnpj)}</td>
                    <td>{ROTULO_TIPO_EMPRESA[e.tipo]}</td>
                    <td>{e.responsavel ?? "—"}<br /><span className="fraco">{[e.email, e.telefone].filter(Boolean).join(" · ")}</span></td>
                    <td className="dir num">{e.contratos}</td>
                    {podeEditar && <td className="dir"><Link href={`/contratos/empresas?editar=${e.id}`} className="botao botao-texto botao-pequeno">Editar</Link></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
