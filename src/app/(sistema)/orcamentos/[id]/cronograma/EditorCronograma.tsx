"use client";

import { useActionState, useState } from "react";
import { Save, SplitSquareHorizontal } from "lucide-react";
import { Avisos } from "@/componentes/Avisos";
import type { Estado } from "../../acoes";

type Etapa = { id: string; ordem: number; nome: string; total: string; percentuais: Record<number, string> };
type Props = {
  acao: (s: Estado, f: FormData) => Promise<Estado>;
  etapas: Etapa[]; periodos: number; unidade: "semana" | "mes"; inicio: string | null; editavel: boolean;
};

const n = (v: string | undefined) => Number(String(v ?? "").replace(",", ".")) || 0;
const br = (v: number) => (Math.round(v * 100) / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export function EditorCronograma({ acao, etapas, periodos: p0, unidade: u0, inicio, editavel }: Props) {
  const [estado, enviar, enviando] = useActionState<Estado, FormData>(acao, {});
  const [periodos, setPeriodos] = useState(p0);
  const [unidade, setUnidade] = useState(u0);
  const [grade, setGrade] = useState<Record<string, Record<number, string>>>(() =>
    Object.fromEntries(etapas.map((e) => [e.id, Object.fromEntries(Object.entries(e.percentuais).map(([k, v]) => [Number(k), br(Number(v))]))])));
  const rotulo = unidade === "mes" ? "Mês" : "Semana";
  const lista = Array.from({ length: Math.max(1, Math.min(60, periodos)) }, (_, i) => i + 1);

  function distribuir(etapaId: string) {
    const ate = lista.length;
    const parte = Math.floor((100 / ate) * 100) / 100;
    const linha: Record<number, string> = {};
    lista.forEach((p) => { linha[p] = br(p === ate ? 100 - parte * (ate - 1) : parte); });
    setGrade({ ...grade, [etapaId]: linha });
  }

  return (
    <form action={enviar} className="grade">
      <Avisos erro={estado.erro} ok={estado.ok} />
      <div className="barra-acoes">
        <div className="campo" style={{ width: 120 }}>
          <label htmlFor="periodos">Prazo</label>
          <input id="periodos" name="periodos" type="number" min={1} max={60} className="entrada-texto num" value={periodos} disabled={!editavel}
            onChange={(e) => setPeriodos(Number(e.target.value) || 1)} />
        </div>
        <div className="campo" style={{ width: 150 }}>
          <label htmlFor="unidadePeriodo">Em</label>
          <select id="unidadePeriodo" name="unidadePeriodo" className="entrada-texto" value={unidade} disabled={!editavel} onChange={(e) => setUnidade(e.target.value as "semana" | "mes")}>
            <option value="mes">Meses</option><option value="semana">Semanas</option>
          </select>
        </div>
        <div className="campo" style={{ width: 180 }}>
          <label htmlFor="inicio">Início previsto</label>
          <input id="inicio" name="inicio" type="date" className="entrada-texto" defaultValue={inicio ?? ""} disabled={!editavel} />
        </div>
        {editavel && <button className="botao botao-primario" disabled={enviando} style={{ alignSelf: "flex-end" }}><Save />{enviando ? "Salvando…" : "Salvar cronograma"}</button>}
      </div>

      <div className="tabela-caixa">
        <table className="tabela tabela-compacta tabela-cronograma">
          <thead>
            <tr>
              <th>Etapa</th>
              {lista.map((p) => <th key={p} className="dir">{rotulo} {p}</th>)}
              <th className="dir">Soma</th>
            </tr>
          </thead>
          <tbody>
            {etapas.map((e) => {
              const soma = lista.reduce((s, p) => s + n(grade[e.id]?.[p]), 0);
              const ok = Math.abs(soma - 100) < 0.0001;
              return (
                <tr key={e.id}>
                  <td style={{ minWidth: 200 }}>
                    <span className="forte">{e.ordem}. {e.nome}</span>
                    {editavel && <button type="button" className="botao botao-texto botao-pequeno" onClick={() => distribuir(e.id)} title="Distribuir igualmente"><SplitSquareHorizontal /> Distribuir</button>}
                  </td>
                  {lista.map((p) => (
                    <td key={p} className="dir">
                      <input name={`p_${e.id}_${p}`} className="entrada-pct num" inputMode="decimal" value={grade[e.id]?.[p] ?? ""} disabled={!editavel}
                        aria-label={`${e.nome}, ${rotulo.toLowerCase()} ${p}, %`}
                        onChange={(ev) => setGrade({ ...grade, [e.id]: { ...grade[e.id], [p]: ev.target.value } })} />
                    </td>
                  ))}
                  <td className={`dir num forte ${ok ? "verde" : "vermelho"}`}>{br(soma)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </form>
  );
}
