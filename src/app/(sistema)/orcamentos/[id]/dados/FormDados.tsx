"use client";

import { useActionState, useMemo, useState } from "react";
import { Save } from "lucide-react";
import { Avisos } from "@/componentes/Avisos";
import { dec, lerNumeroBr, texto } from "@/lib/decimal";
import {
  calcularBdi, conferirBdi, FAIXAS_TCU, PARCELAS_BDI, ROTULO_PARCELA, ROTULO_TIPO_BDI, TIPOS_OBRA_BDI,
  type Bdi, type ParcelaBdi, type TipoObraBdi,
} from "@/servicos/calculo";
import type { Estado } from "../../acoes";

type Valores = {
  nome: string; arredondamento: "arredondar" | "truncar"; tipoObraBdi: TipoObraBdi; bdiObra: Bdi; bdiFornecimento: Bdi;
  encargosHorista: string; encargosMensalista: string; responsavelTecnico: string; registroProfissional: string; art: string;
};

const br = (v: string) => (v === "" ? "" : String(Number(v)).replace(".", ","));
const deBr = (b: Record<ParcelaBdi, string>): Bdi =>
  Object.fromEntries(PARCELAS_BDI.map((p) => [p, texto(lerNumeroBr(b[p]) ?? dec(0))])) as Bdi;

function Parcelas({ prefixo, titulo, valores, onChange, tipo, editavel }: {
  prefixo: string; titulo: string; valores: Record<ParcelaBdi, string>; onChange: (v: Record<ParcelaBdi, string>) => void; tipo: TipoObraBdi; editavel: boolean;
}) {
  const bdi = useMemo(() => { try { return calcularBdi(deBr(valores)); } catch { return null; } }, [valores]);
  const avisos = useMemo(() => { try { return conferirBdi(deBr(valores), tipo); } catch { return []; } }, [valores, tipo]);
  const fora = new Set(avisos.map((a) => a.parcela));
  const faixa = FAIXAS_TCU[tipo];
  return (
    <section className="cartao">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <h3 className="cartao-titulo">{titulo}</h3>
        <span className="numero-bdi num">{bdi == null ? "—" : `${texto(bdi).replace(".", ",")}%`}</span>
      </div>
      <div className="grade-bdi">
        {PARCELAS_BDI.map((p) => {
          const f = faixa[p as keyof typeof faixa];
          return (
            <div key={p} className="campo">
              <label htmlFor={`${prefixo}_${p}`}>{ROTULO_PARCELA[p]} (%)</label>
              <input id={`${prefixo}_${p}`} name={`${prefixo}_${p}`} className="entrada-texto num" inputMode="decimal" value={valores[p]} disabled={!editavel}
                aria-invalid={fora.has(p)} onChange={(e) => onChange({ ...valores, [p]: e.target.value })} />
              {f && <span className={fora.has(p) ? "erro" : "dica"}>TCU: {f[0].replace(".", ",")} a {f[2].replace(".", ",")}</span>}
            </div>
          );
        })}
      </div>
      {faixa.bdi && (
        <p className={fora.has("bdi") ? "aviso aviso-erro" : "cartao-sub"} style={{ marginTop: 12 }}>
          Faixa de referência do BDI para {ROTULO_TIPO_BDI[tipo].toLowerCase()}: {faixa.bdi[0].replace(".", ",")}% a {faixa.bdi[2].replace(".", ",")}% (médio {faixa.bdi[1].replace(".", ",")}%).
        </p>
      )}
    </section>
  );
}

export function FormDados({ acao, iniciais, editavel }: { acao: (s: Estado, f: FormData) => Promise<Estado>; iniciais: Valores; editavel: boolean }) {
  const [estado, enviar, enviando] = useActionState<Estado, FormData>(acao, {});
  const [tipo, setTipo] = useState<TipoObraBdi>(iniciais.tipoObraBdi);
  const paraTela = (b: Bdi) => Object.fromEntries(PARCELAS_BDI.map((p) => [p, br(b[p])])) as Record<ParcelaBdi, string>;
  const [obra, setObra] = useState(paraTela(iniciais.bdiObra));
  const [forn, setForn] = useState(paraTela(iniciais.bdiFornecimento));
  const c = (nome: keyof Valores, rotulo: string, cls: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className={`campo ${cls}`}>
      <label htmlFor={nome}>{rotulo}</label>
      <input id={nome} name={nome} className="entrada-texto" defaultValue={iniciais[nome] as string} disabled={!editavel} {...extra} />
    </div>
  );
  return (
    <form action={enviar} className="grade">
      <Avisos erro={estado.erro} ok={estado.ok} />
      <section className="cartao">
        <h3 className="cartao-titulo" style={{ marginBottom: 14 }}>Dados gerais</h3>
        <div className="grade-form">
          {c("nome", "Nome do orçamento", "c6", { required: true })}
          <div className="campo c3">
            <label htmlFor="arredondamento">Casas decimais</label>
            <select id="arredondamento" name="arredondamento" className="entrada-texto" defaultValue={iniciais.arredondamento} disabled={!editavel}>
              <option value="arredondar">Arredondar em 2 casas</option><option value="truncar">Truncar em 2 casas</option>
            </select>
          </div>
          <div className="campo c3">
            <label htmlFor="tipoObraBdi">Tipo de obra (BDI)</label>
            <select id="tipoObraBdi" name="tipoObraBdi" className="entrada-texto" value={tipo} onChange={(e) => setTipo(e.target.value as TipoObraBdi)} disabled={!editavel}>
              {TIPOS_OBRA_BDI.filter((t) => t !== "fornecimento").map((t) => <option key={t} value={t}>{ROTULO_TIPO_BDI[t]}</option>)}
            </select>
          </div>
          {c("responsavelTecnico", "Responsável técnico", "c6")}
          {c("registroProfissional", "CREA ou CAU", "c3")}
          {c("art", "ART ou RRT", "c3")}
          {c("encargosHorista", "Encargos sociais, horista (%)", "c3", { inputMode: "decimal" })}
          {c("encargosMensalista", "Encargos sociais, mensalista (%)", "c3", { inputMode: "decimal" })}
        </div>
      </section>
      <div className="grade duas-colunas" style={{ gridTemplateColumns: "1fr 1fr", alignItems: "start" }}>
        <Parcelas prefixo="obra" titulo="BDI da obra" valores={obra} onChange={setObra} tipo={tipo} editavel={editavel} />
        <Parcelas prefixo="forn" titulo="BDI de fornecimento de materiais e equipamentos" valores={forn} onChange={setForn} tipo="fornecimento" editavel={editavel} />
      </div>
      {editavel && <button className="botao botao-primario" disabled={enviando} style={{ justifySelf: "start" }}><Save />{enviando ? "Salvando…" : "Salvar"}</button>}
    </form>
  );
}
