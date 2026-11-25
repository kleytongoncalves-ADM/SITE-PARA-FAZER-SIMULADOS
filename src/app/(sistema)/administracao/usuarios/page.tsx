import type { Metadata } from "next";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { pode } from "@/servicos/permissoes";
import { ROTULO_PERFIL } from "@/servicos/rotulos";
import { listarUsuarios } from "@/servicos/usuarios";
import { BotaoAtivo, FormUsuario } from "./Formularios";

export const metadata: Metadata = { title: "Usuários" };

export default async function Usuarios() {
  const u = await exigirUsuario();
  const ator = comoAtor(u);
  if (!pode(ator, "usuario.gerenciar")) {
    return <div className="cartao vazio"><b>Acesso restrito</b>Só o administrador do sistema gerencia usuários.</div>;
  }
  const usuarios = await listarUsuarios(ator);
  const ativos = usuarios.filter((x) => x.ativo).length;
  return (
    <>
      <div className="cabecalho">
        <div>
          <div className="sobretitulo">Sistema</div>
          <h1 className="titulo">Usuários e perfis</h1>
          <p className="subtitulo"><b>{ativos}</b> {ativos === 1 ? "pessoa pode" : "pessoas podem"} entrar no sistema. O perfil define o que cada uma vê e faz.</p>
        </div>
      </div>
      <div className="grade duas-colunas" style={{ gridTemplateColumns: "minmax(0, 1.7fr) minmax(0, 1fr)", alignItems: "start" }}>
        <div className="tabela-caixa surgir">
          <table className="tabela">
            <thead><tr><th>Pessoa</th><th>Perfil</th><th>Situação</th><th /></tr></thead>
            <tbody>
              {usuarios.map((x) => (
                <tr key={x.id}>
                  <td><span className="forte">{x.nome}</span>{x.id === u.id && <span className="etiqueta et-azul" style={{ marginLeft: 8 }}>Você</span>}<br /><span className="fraco">{x.email}</span></td>
                  <td>{ROTULO_PERFIL[x.perfil]}{x.administrador && <><br /><span className="fraco">Administrador</span></>}</td>
                  <td><span className={`etiqueta ${x.ativo ? "et-verde" : "et-neutra"}`}>{x.ativo ? "Ativo" : "Desativado"}</span></td>
                  <td style={{ textAlign: "right" }}>{x.id !== u.id && <BotaoAtivo usuarioId={x.id} ativo={x.ativo} nome={x.nome} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <section className="cartao surgir" style={{ "--i": 1 } as React.CSSProperties}>
          <h2 className="cartao-titulo">Novo acesso</h2>
          <p className="cartao-sub" style={{ marginBottom: 14 }}>Usuários não são excluídos, só desativados, para o histórico continuar íntegro.</p>
          <FormUsuario />
        </section>
      </div>
    </>
  );
}
