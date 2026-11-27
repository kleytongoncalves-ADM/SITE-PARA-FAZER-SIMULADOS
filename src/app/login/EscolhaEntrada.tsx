"use client";

import { useState, useSyncExternalStore } from "react";
import { Building2, HardHat } from "lucide-react";
import { FormEntradaFornecedor } from "@/componentes/fornecedor/FormEntradaFornecedor";
import { FormLogin } from "./FormLogin";

type Perfil = "contratante" | "fornecedor";
const CHAVE = "civiobra-entrada";
function lerEscolha(): Perfil | null {
  try { return localStorage.getItem(CHAVE) === "fornecedor" ? "fornecedor" : null; } catch { return null; }
}

/** Entrada única: Contratante ou Fornecedor, na própria tela. A última escolha fica lembrada neste navegador. */
export function EscolhaEntrada({ inicial }: { inicial: Perfil | null }) {
  const lembrado = useSyncExternalStore(() => () => {}, lerEscolha, () => null);
  const [escolhido, setPerfil] = useState<Perfil | null>(inicial);
  const perfil: Perfil = escolhido ?? lembrado ?? "contratante";
  function escolher(p: Perfil) {
    setPerfil(p);
    try { localStorage.setItem(CHAVE, p); } catch {}
  }
  const fornecedor = perfil === "fornecedor";
  return (
    <div className={fornecedor ? "entrada-perfil entrada-perfil-fornecedor" : "entrada-perfil"}>
      <div className="entrada-escolha" role="tablist" aria-label="Entrar como">
        <button type="button" role="tab" aria-selected={!fornecedor} className={!fornecedor ? "ativa" : ""} onClick={() => escolher("contratante")}>
          <HardHat /><span><b>Contratante</b><small>Órgão ou empresa</small></span>
        </button>
        <button type="button" role="tab" aria-selected={fornecedor} className={fornecedor ? "ativa" : ""} onClick={() => escolher("fornecedor")}>
          <Building2 /><span><b>Fornecedor</b><small>Responde cotações</small></span>
        </button>
      </div>
      <h1 className="entrada-titulo">{fornecedor ? "Área do fornecedor" : "Entrar"}</h1>
      {fornecedor ? <FormEntradaFornecedor key="f" /> : <FormLogin key="c" />}
    </div>
  );
}
