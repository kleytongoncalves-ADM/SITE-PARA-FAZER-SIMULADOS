import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { exigirDono } from "@/lib/sessao";
import { FormMinhaSenha } from "../Formularios";

export const metadata: Metadata = { title: "Minha conta · Administração" };

export default async function MinhaConta() {
  const dono = await exigirDono();
  return (
    <>
      <div className="cabecalho">
        <div>
          <div className="sobretitulo"><Link href="/plataforma" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><ArrowLeft size={14} />Empresas</Link></div>
          <h1 className="titulo">Minha conta</h1>
          <p className="subtitulo">{dono.nome} · {dono.email}</p>
        </div>
      </div>
      <section className="cartao surgir" style={{ maxWidth: 460 }}>
        <h2 className="cartao-titulo">Trocar minha senha</h2>
        <p className="cartao-sub" style={{ marginBottom: 14 }}>Ao trocar, você continua conectado aqui e as outras sessões são encerradas.</p>
        <FormMinhaSenha />
      </section>
    </>
  );
}
