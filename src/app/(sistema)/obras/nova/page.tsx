import type { Metadata } from "next";
import Link from "next/link";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { pode } from "@/servicos/permissoes";
import { FormObra } from "../FormObra";

export const metadata: Metadata = { title: "Cadastrar obra" };

export default async function NovaObra() {
  const u = await exigirUsuario();
  if (!pode(comoAtor(u), "obra.criar")) {
    return (
      <div className="cartao vazio">
        <b>Seu perfil não cadastra obras</b>
        Quem pode cadastrar: direção, engenheiro responsável e administrativo. Peça o acesso ao administrador do sistema.
      </div>
    );
  }
  return (
    <>
      <div className="cabecalho">
        <div>
          <div className="sobretitulo"><Link href="/obras">Obras</Link><span>/</span><span>Nova</span></div>
          <h1 className="titulo">Cadastrar obra</h1>
          <p className="subtitulo">A obra começa <b>em estudo</b>. Só o código e o nome são obrigatórios agora.</p>
        </div>
      </div>
      <FormObra id={null} iniciais={{ uf: "RJ" }} cancelar="/obras" />
    </>
  );
}
