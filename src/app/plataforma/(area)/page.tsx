import type { Metadata } from "next";
import Link from "next/link";
import { Building2, ChevronRight } from "lucide-react";
import { listarEmpresas, ROTULO_ESFERA } from "@/servicos/plataforma";
import { PERFIS, ROTULO_PERFIL } from "@/servicos/rotulos";
import { FormEmpresa } from "./Formularios";

export const metadata: Metadata = { title: "Empresas · Administração" };

export default async function QuadroEmpresas() {
  const empresas = await listarEmpresas();
  const ativas = empresas.filter((e) => e.ativo).length;
  const pessoas = empresas.reduce((s, e) => s + e.ativos, 0);
  return (
    <>
      <div className="cabecalho">
        <div>
          <div className="sobretitulo">Administração da plataforma</div>
          <h1 className="titulo">Empresas</h1>
          <p className="subtitulo">
            <b>{ativas}</b> {ativas === 1 ? "empresa ativa" : "empresas ativas"} e <b>{pessoas}</b> {pessoas === 1 ? "pessoa com acesso" : "pessoas com acesso"}. Clique numa empresa para ver e cadastrar os funcionários.
          </p>
        </div>
      </div>
      <div className="grade duas-colunas" style={{ gridTemplateColumns: "minmax(0, 1.9fr) minmax(0, 1fr)", alignItems: "start" }}>
        {empresas.length === 0 ? (
          <div className="cartao vazio surgir">
            <b>Nenhuma empresa cadastrada</b>
            Cadastre a primeira empresa ao lado. Depois, dentro dela, crie o acesso de cada funcionário com e-mail e senha.
          </div>
        ) : (
          <div className="quadro-empresas">
            {empresas.map((e, i) => (
              <Link key={e.id} href={`/plataforma/empresas/${e.id}`} className={`cartao empresa surgir ${e.ativo ? "" : "empresa-desativada"}`} style={{ "--i": i } as React.CSSProperties}>
                <div className="empresa-topo">
                  <span className="empresa-icone"><Building2 /></span>
                  <div style={{ minWidth: 0 }}>
                    <div className="empresa-nome">{e.nome}</div>
                    <div className="empresa-meta">{ROTULO_ESFERA[e.esfera]}{e.municipio ? ` · ${e.municipio}` : ""}/{e.uf}</div>
                  </div>
                </div>
                <div className="empresa-cargos">
                  {PERFIS.filter((p) => e.porCargo[p]).map((p) => (
                    <span key={p}><b className="num">{e.porCargo[p]}</b>{ROTULO_PERFIL[p]}</span>
                  ))}
                  {e.ativos === 0 && <span>Nenhum funcionário ainda</span>}
                </div>
                <div className="empresa-rodape">
                  <span><b className="num" style={{ color: "var(--texto)" }}>{e.ativos}</b> {e.ativos === 1 ? "funcionário" : "funcionários"}</span>
                  {e.ativo ? <ChevronRight size={16} /> : <span className="etiqueta et-neutra">Desativada</span>}
                </div>
              </Link>
            ))}
          </div>
        )}
        <section className="cartao surgir" style={{ "--i": 1 } as React.CSSProperties}>
          <h2 className="cartao-titulo">Nova empresa</h2>
          <p className="cartao-sub" style={{ marginBottom: 14 }}>Cada empresa só enxerga as próprias obras e os próprios dados.</p>
          <FormEmpresa />
        </section>
      </div>
    </>
  );
}
