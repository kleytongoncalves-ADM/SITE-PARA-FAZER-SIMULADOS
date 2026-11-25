"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Save } from "lucide-react";
import { Avisos } from "@/componentes/Avisos";
import { FORMAS_EXECUCAO, ROTULO_FORMA, ROTULO_TIPO, TIPOS_OBRA } from "@/servicos/rotulos";
import { acaoSalvarObra, type Estado } from "./acoes";

type Props = { id: string | null; iniciais: Record<string, string>; cancelar: string };

export function FormObra({ id, iniciais, cancelar }: Props) {
  const [estado, acao, enviando] = useActionState<Estado, FormData>(acaoSalvarObra.bind(null, id), {});
  const v = (k: string) => estado.valores?.[k] ?? iniciais[k] ?? "";
  const e = (k: string) => estado.erros?.[k];

  const campo = (nome: string, rotulo: string, cls: string, extra: React.InputHTMLAttributes<HTMLInputElement> & { dica?: string } = {}) => {
    const { dica, ...resto } = extra;
    return (
      <div className={`campo ${cls}`}>
        <label htmlFor={nome}>{rotulo}</label>
        <input id={nome} name={nome} className="entrada-texto" defaultValue={v(nome)} aria-invalid={!!e(nome)} aria-describedby={e(nome) ? `${nome}-erro` : undefined} {...resto} />
        {e(nome) ? <span className="erro" id={`${nome}-erro`}>{e(nome)}</span> : dica ? <span className="dica">{dica}</span> : null}
      </div>
    );
  };

  return (
    <form action={acao} style={{ display: "grid", gap: 18 }} key={JSON.stringify(estado.valores ?? {})}>
      <Avisos erro={estado.erro} />

      <section className="cartao surgir" style={{ "--i": 0 } as React.CSSProperties}>
        <h2 className="cartao-titulo">Identificação</h2>
        <div className="grade-form">
          {campo("codigo", "Código", "c4", { required: true, maxLength: 30, placeholder: "OB-2026-001" })}
          {campo("nome", "Nome da obra", "c8", { required: true, placeholder: "Reforma da Unidade de Saúde Central" })}
          <div className="campo c6">
            <label htmlFor="tipo">Tipo</label>
            <select id="tipo" name="tipo" className="entrada-texto" defaultValue={v("tipo") || "edificacao"}>
              {TIPOS_OBRA.map((t) => <option key={t} value={t}>{ROTULO_TIPO[t]}</option>)}
            </select>
            {e("tipo") && <span className="erro">{e("tipo")}</span>}
          </div>
          <div className="campo c6">
            <label htmlFor="formaExecucao">Forma de execução</label>
            <select id="formaExecucao" name="formaExecucao" className="entrada-texto" defaultValue={v("formaExecucao") || "contratada"}>
              {FORMAS_EXECUCAO.map((t) => <option key={t} value={t}>{ROTULO_FORMA[t]}</option>)}
            </select>
          </div>
        </div>
      </section>

      <section className="cartao surgir" style={{ "--i": 1 } as React.CSSProperties}>
        <h2 className="cartao-titulo">Localização e porte</h2>
        <div className="grade-form" style={{ marginTop: 16 }}>
          {campo("endereco", "Endereço", "c12", { placeholder: "Rua, número, bairro" })}
          {campo("municipio", "Município", "c8")}
          {campo("uf", "UF", "c4", { maxLength: 2, placeholder: "RJ", style: { textTransform: "uppercase" } })}
          {campo("latitude", "Latitude", "c3", { inputMode: "decimal", placeholder: "-22,906847" })}
          {campo("longitude", "Longitude", "c3", { inputMode: "decimal", placeholder: "-43,172896" })}
          {campo("areaM2", "Área (m²)", "c3", { inputMode: "decimal", dica: "Para edificações e reformas." })}
          {campo("extensaoM", "Extensão (m)", "c3", { inputMode: "decimal", dica: "Para vias, redes e muros." })}
        </div>
      </section>

      <section className="cartao surgir" style={{ "--i": 2 } as React.CSSProperties}>
        <h2 className="cartao-titulo">Processo e recursos</h2>
        <div className="grade-form" style={{ marginTop: 16 }}>
          {campo("processoAdministrativo", "Processo administrativo", "c6")}
          {campo("licitacao", "Licitação (modalidade e número)", "c6")}
          {campo("fonteRecurso", "Fonte de recurso", "c6")}
          {campo("convenio", "Convênio", "c6")}
        </div>
      </section>

      <section className="cartao surgir" style={{ "--i": 3 } as React.CSSProperties}>
        <h2 className="cartao-titulo">Prazos e documentos de início</h2>
        <div className="grade-form">
          {campo("dataInicioPrevista", "Início previsto", "c3", { type: "date" })}
          {campo("dataFimPrevista", "Término previsto", "c3", { type: "date" })}
          {campo("artNumero", "ART ou RRT", "c6", { placeholder: "Número do registro" })}
          {campo("ordemServicoNumero", "Ordem de serviço", "c6", { placeholder: "OS 12/2026" })}
          {campo("ordemServicoData", "Data da ordem de serviço", "c3", { type: "date" })}
        </div>
      </section>

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
        <Link href={cancelar} className="botao botao-neutro">Cancelar</Link>
        <button className="botao botao-primario" disabled={enviando}><Save />{enviando ? "Salvando…" : id ? "Salvar alterações" : "Cadastrar obra"}</button>
      </div>
    </form>
  );
}
