import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { exigirDono } from "@/lib/sessao";
import { listarFuncionarios, obterEmpresa, ROTULO_ESFERA } from "@/servicos/plataforma";
import { AcoesEmpresa, Equipe } from "../../Equipe";

export const metadata: Metadata = { title: "Empresa · Administração" };

export default async function PaginaEmpresa({ params }: { params: Promise<{ id: string }> }) {
  await exigirDono();
  const { id } = await params;
  // As duas consultas saem juntas: a página espera uma ida ao banco, não duas.
  const [empresa, funcionarios] = await Promise.all([obterEmpresa(id), listarFuncionarios(id)]);
  if (!empresa) notFound();

  const ativos = funcionarios.filter((f) => f.ativo);
  const indicadores: [string, number][] = [
    ["Ativos", ativos.length],
    ["Administradores", ativos.filter((f) => f.administrador).length],
    ["Bloqueados", funcionarios.filter((f) => f.bloqueado).length],
    ["Inativos", funcionarios.length - ativos.length],
  ];

  return (
    <>
      <div className="cabecalho">
        <div style={{ minWidth: 0 }}>
          <div className="sobretitulo"><Link href="/plataforma" className="voltar"><ArrowLeft size={14} />Empresas</Link></div>
          <h1 className="titulo">
            {empresa.nome}
            {!empresa.ativo && <span className="etiqueta et-neutra titulo-etiqueta">Inativa</span>}
          </h1>
          <p className="subtitulo">
            {ROTULO_ESFERA[empresa.esfera]}
            {empresa.cnpj && <> · CNPJ <span className="num">{empresa.cnpj}</span></>}
            {" · "}{empresa.municipio ? `${empresa.municipio}/` : ""}{empresa.uf}
          </p>
        </div>
        <AcoesEmpresa
          empresa={{ id: empresa.id, nome: empresa.nome, cnpj: empresa.cnpj ?? "", esfera: empresa.esfera, uf: empresa.uf, municipio: empresa.municipio ?? "", ativo: empresa.ativo }}
        />
      </div>

      <div className="resumo-equipe">
        {indicadores.map(([rotulo, n]) => (
          <div key={rotulo} className={`resumo-item ${rotulo === "Bloqueados" && n > 0 ? "resumo-alerta" : ""}`}>
            <b className="num">{n}</b><span>{rotulo}</span>
          </div>
        ))}
      </div>

      <Equipe empresaId={empresa.id} pessoas={funcionarios} />
    </>
  );
}
