import type { Metadata } from "next";
import Link from "next/link";
import { dataCurta } from "@/lib/formato";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { painelDiarios } from "@/servicos/campo";
import { pode } from "@/servicos/permissoes";

export const metadata: Metadata = { title: "Diário de obra" };

export default async function Diarios() {
  const ator = comoAtor(await exigirUsuario());
  if (!pode(ator, "diario.ver")) return <div className="cartao vazio"><b>Seu perfil não acessa o diário de obra</b></div>;
  const p = await painelDiarios(ator);
  const semHoje = p.linhas.filter((l) => l.obra.situacao === "em_execucao" && !l.hoje).length;
  const pend = p.linhas.reduce((s, l) => s + l.pendentes, 0);
  const visto = p.linhas.reduce((s, l) => s + l.semVisto, 0);

  return (
    <>
      <div className="cabecalho">
        <div>
          <div className="sobretitulo">Executar</div>
          <h1 className="titulo">Diário de obra</h1>
        </div>
      </div>
      <div className="indicadores">
        <div className="indicador surgir"><span>Obras em execução</span><b className="num">{p.linhas.length}</b></div>
        <div className="indicador surgir"><span>Sem diário hoje</span><b className="num">{semHoje}</b></div>
        <div className={`indicador surgir${pend ? " indicador-destaque" : ""}`}><span>Dias úteis sem diário</span><b className="num">{pend}</b></div>
        <div className="indicador surgir"><span>Aguardando visto do fiscal</span><b className="num">{visto}</b></div>
      </div>
      {p.linhas.length === 0 ? (
        <div className="cartao vazio"><b>Nenhuma obra em execução</b>O diário é aberto nas obras em execução.</div>
      ) : (
        <div className="tabela-caixa surgir">
          <table className="tabela">
            <thead><tr><th>Obra</th><th>Hoje</th><th>Último diário</th><th className="dir">Dias sem diário</th><th className="dir">Sem visto</th><th /></tr></thead>
            <tbody>
              {p.linhas.map((l) => (
                <tr key={l.obra.id}>
                  <td><Link href={`/obras/${l.obra.id}/diario`} className="forte">{l.obra.nome}</Link><div className="fraco num">{l.obra.codigo}</div></td>
                  <td>{l.hoje ? <span className={`etiqueta ${l.hoje.situacao === "assinado" ? "et-verde" : "et-laranja"}`}>{l.hoje.situacao === "assinado" ? "Assinado" : "Em elaboração"}</span>
                    : <span className="etiqueta et-neutra">Não aberto</span>}</td>
                  <td className="num">{l.ultimo ? <Link href={`/diario/${l.ultimo.id}`}>nº {l.ultimo.numero} · {dataCurta(l.ultimo.data)}</Link> : "—"}</td>
                  <td className="dir num">{l.pendentes ? <span className="etiqueta et-vermelha">{l.pendentes}</span> : "0"}</td>
                  <td className="dir num">{l.semVisto}</td>
                  <td className="dir">{l.hoje
                    ? <Link href={`/diario/${l.hoje.id}`} className="botao botao-neutro botao-pequeno">Abrir</Link>
                    : <Link href={`/obras/${l.obra.id}/diario`} className="botao botao-neutro botao-pequeno">Calendário</Link>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
