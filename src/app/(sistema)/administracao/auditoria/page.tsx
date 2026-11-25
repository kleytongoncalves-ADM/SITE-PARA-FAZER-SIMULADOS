import type { Metadata } from "next";
import Link from "next/link";
import { dataHora } from "@/lib/formato";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { listarAuditoria } from "@/servicos/auditoria";
import { pode } from "@/servicos/permissoes";
import {
  ROTULO_CAMPO, ROTULO_FORMA, ROTULO_PAPEL, ROTULO_PERFIL, ROTULO_SITUACAO, ROTULO_TABELA, ROTULO_TIPO,
} from "@/servicos/rotulos";

export const metadata: Metadata = { title: "Auditoria" };

const TRADUCOES: Record<string, Record<string, string>> = {
  situacao: ROTULO_SITUACAO, tipo: ROTULO_TIPO, forma_execucao: ROTULO_FORMA, perfil: ROTULO_PERFIL, papel: ROTULO_PAPEL,
  ativo: { true: "Sim", false: "Não" }, administrador: { true: "Sim", false: "Não" },
};
const valor = (campo: string | null, v: string | null) => (v == null || v === "" ? "vazio" : (campo && TRADUCOES[campo]?.[v]) ?? v);

export default async function Auditoria({ searchParams }: { searchParams: Promise<{ tabela?: string }> }) {
  const { tabela } = await searchParams;
  const ator = comoAtor(await exigirUsuario());
  if (!pode(ator, "auditoria.ver")) {
    return <div className="cartao vazio"><b>Sem permissão</b></div>;
  }
  const linhas = await listarAuditoria(ator, { tabela });
  return (
    <>
      <div className="cabecalho">
        <div>
          <div className="sobretitulo">Sistema</div>
          <h1 className="titulo">Auditoria</h1>
          <p className="subtitulo">Últimos <b>{linhas.length}</b> registros.</p>
        </div>
      </div>
      <div className="chips" style={{ marginBottom: 16 }}>
        <Link href="/administracao/auditoria" className={`chip ${!tabela ? "chip-ativo" : ""}`}>Tudo</Link>
        {Object.entries(ROTULO_TABELA).map(([k, r]) => (
          <Link key={k} href={`/administracao/auditoria?tabela=${k}`} className={`chip ${tabela === k ? "chip-ativo" : ""}`}>{r}</Link>
        ))}
      </div>
      {linhas.length === 0 ? (
        <div className="cartao vazio"><b>Nenhum registro</b></div>
      ) : (
        <div className="tabela-caixa surgir">
          <table className="tabela">
            <thead><tr><th>Quando</th><th>Quem</th><th>Registro</th><th>O que mudou</th></tr></thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.id}>
                  <td className="num" style={{ whiteSpace: "nowrap" }}>{dataHora(new Date(l.quando))}</td>
                  <td>{l.autor ?? "Sistema"}</td>
                  <td><span className="forte">{ROTULO_TABELA[l.tabela] ?? l.tabela}</span><br /><span className="fraco">{l.registro ?? "—"}</span></td>
                  <td>
                    {l.acao === "criou" ? (
                      <span className="etiqueta et-verde">Criou o registro</span>
                    ) : (
                      <>
                        <span className="forte">{ROTULO_CAMPO[l.campo ?? ""] ?? l.campo}</span><br />
                        <span className="fraco">de <s>{valor(l.campo, l.valorAnterior)}</s> para <b style={{ color: "var(--texto)" }}>{valor(l.campo, l.valorNovo)}</b></span>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
