import type { Metadata } from "next";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { pode } from "@/servicos/permissoes";
import { ncsEmAberto } from "@/servicos/qualidade";
import { TabelaNcs } from "./Componentes";

export const metadata: Metadata = { title: "Qualidade" };

export default async function Qualidade() {
  const ator = comoAtor(await exigirUsuario());
  if (!pode(ator, "qualidade.ver")) return <div className="cartao vazio"><b>Seu perfil não acessa a qualidade</b></div>;
  const ncs = await ncsEmAberto(ator, "qualidade");
  const obras = new Set(ncs.map((n) => n.obraId)).size;
  return (
    <>
      <div className="cabecalho"><div><div className="sobretitulo">Controlar</div><h1 className="titulo">Qualidade</h1></div></div>
      <div className="indicadores">
        <div className="indicador surgir"><span>Não conformidades em aberto</span><b className="num">{ncs.length}</b><small>em {obras} {obras === 1 ? "obra" : "obras"}</small></div>
        <div className={`indicador surgir${ncs.some((n) => n.vencida) ? " indicador-destaque" : ""}`}><span>Prazo vencido</span><b className="num">{ncs.filter((n) => n.vencida).length}</b></div>
        <div className="indicador surgir"><span>Aguardando verificação do fiscal</span><b className="num">{ncs.filter((n) => n.situacao === "corrigida").length}</b></div>
        <div className="indicador surgir"><span>Travando medição</span><b className="num">{ncs.filter((n) => n.impeditiva).length}</b></div>
      </div>
      <TabelaNcs ncs={ncs} obra />
    </>
  );
}
