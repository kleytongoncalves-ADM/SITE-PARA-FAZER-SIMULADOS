import type { Metadata } from "next";
import Link from "next/link";
import { Building2, ChevronRight } from "lucide-react";
import { listarEmpresas, ROTULO_ESFERA } from "@/servicos/plataforma";
import { PERFIS, ROTULO_PERFIL } from "@/servicos/rotulos";
import { NovaEmpresa } from "./Equipe";

export const metadata: Metadata = { title: "Empresas · Administração" };

export default async function QuadroEmpresas() {
  const empresas = await listarEmpresas();
  const ativas = empresas.filter((e) => e.ativo).length;
  const pessoas = empresas.reduce((s, e) => s + e.ativos, 0);
  return (
    <>
      <div className="cabecalho">
        <div>
          <div className="sobretitulo">Administração</div>
          <h1 className="titulo">Empresas</h1>
          <p className="subtitulo">
            <b>{ativas}</b> {ativas === 1 ? "empresa" : "empresas"} · <b>{pessoas}</b> {pessoas === 1 ? "funcionário" : "funcionários"}
          </p>
        </div>
        <NovaEmpresa abrirJa={empresas.length === 0} />
      </div>

      {empresas.length === 0 ? (
        <div className="cartao vazio">
          <b>Nenhuma empresa cadastrada</b>
        </div>
      ) : (
        <div className="quadro-empresas">
          {empresas.map((e, i) => {
            const cargos = PERFIS.filter((p) => e.porCargo[p]);
            const visiveis = cargos.slice(0, 1);
            return (
              <Link key={e.id} href={`/plataforma/empresas/${e.id}`} className={`cartao empresa surgir ${e.ativo ? "" : "empresa-desativada"}`} style={{ "--i": i } as React.CSSProperties} title={e.nome}>
                <div className="empresa-topo">
                  <span className="empresa-icone"><Building2 /></span>
                  <div style={{ minWidth: 0 }}>
                    <div className="empresa-nome">{e.nome}</div>
                    <div className="empresa-meta">{ROTULO_ESFERA[e.esfera]}{e.municipio ? ` · ${e.municipio}` : ""}/{e.uf}</div>
                  </div>
                </div>
                <div className="empresa-cargos">
                  {visiveis.map((p) => (
                    <span key={p}><b className="num">{e.porCargo[p]}</b>{ROTULO_PERFIL[p]}</span>
                  ))}
                  {cargos.length > 1 && <span>+{cargos.length - 1} {cargos.length - 1 === 1 ? "cargo" : "cargos"}</span>}
                  {cargos.length === 0 && <span>Sem funcionários</span>}
                </div>
                <div className="empresa-rodape">
                  <span><b className="num" style={{ color: "var(--texto)" }}>{e.ativos}</b> {e.ativos === 1 ? "funcionário" : "funcionários"}</span>
                  {e.ativo ? <ChevronRight size={16} /> : <span className="etiqueta et-neutra">Inativa</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
