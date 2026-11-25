"use client";

import { useState } from "react";

export type OpcoesDocumento = {
  categorias: { valor: string; rotulo: string; tipos: string[] }[];
  exigencias: { valor: string; rotulo: string; categoria: string; tipo: string }[];
  contratos: { id: string; numero: string }[];
};
export type ValoresDocumento = {
  categoria?: string; tipo?: string; titulo?: string; numero?: string | null; emissor?: string | null; emissao?: string | null; validade?: string | null;
  exigencia?: string | null; contratoId?: string | null; conselho?: string | null; profissional?: string | null; registro?: string | null; atividade?: string | null;
};

/** Campos do documento. A categoria define os tipos sugeridos, as exigências possíveis e os campos da ART/RRT. */
export function CamposDocumento({ opcoes, valores = {}, prefixo, categoriaFixa }: { opcoes: OpcoesDocumento; valores?: ValoresDocumento; prefixo: string; categoriaFixa?: boolean }) {
  const [categoria, setCategoria] = useState(valores.categoria ?? "");
  const [tipo, setTipo] = useState(valores.tipo ?? "");
  const [exigencia, setExigencia] = useState(valores.exigencia ?? "");
  const cat = opcoes.categorias.find((c) => c.valor === categoria);
  const exigencias = opcoes.exigencias.filter((e) => e.categoria === categoria);
  const art = categoria === "art_rrt";
  const id = (k: string) => `${prefixo}-${k}`;

  return (
    <>
      <div className="campo c3"><label htmlFor={id("cat")}>Categoria</label>
        {categoriaFixa ? <input id={id("cat")} className="entrada-texto" value={cat?.rotulo ?? ""} disabled /> : (
          <select id={id("cat")} name="categoria" className="entrada-texto" required value={categoria}
            onChange={(e) => { setCategoria(e.target.value); setExigencia(""); }}>
            <option value="" disabled>Escolha</option>
            {opcoes.categorias.map((c) => <option key={c.valor} value={c.valor}>{c.rotulo}</option>)}
          </select>)}
      </div>
      <div className="campo c4"><label htmlFor={id("tipo")}>Tipo</label>
        <input id={id("tipo")} name="tipo" className="entrada-texto" list={id("tipos")} required value={tipo} onChange={(e) => setTipo(e.target.value)} autoComplete="off" />
        <datalist id={id("tipos")}>{(cat?.tipos ?? []).map((t) => <option key={t} value={t} />)}</datalist>
      </div>
      <div className="campo c5"><label htmlFor={id("tit")}>Título</label>
        <input id={id("tit")} name="titulo" className="entrada-texto" required defaultValue={valores.titulo ?? ""} placeholder={tipo || undefined} /></div>

      <div className="campo c3"><label htmlFor={id("num")}>{art ? "Número da ART ou RRT" : "Número"}</label>
        <input id={id("num")} name="numero" className="entrada-texto" required={art} defaultValue={valores.numero ?? ""} /></div>
      <div className="campo c3"><label htmlFor={id("emi")}>Emissor</label>
        <input id={id("emi")} name="emissor" className="entrada-texto" defaultValue={valores.emissor ?? ""} placeholder={art ? "CREA-RJ" : "Órgão ou autor"} /></div>
      <div className="campo c2"><label htmlFor={id("em")}>Emissão</label>
        <input id={id("em")} name="emissao" type="date" className="entrada-texto" defaultValue={valores.emissao ?? ""} /></div>
      <div className="campo c2"><label htmlFor={id("val")}>Validade</label>
        <input id={id("val")} name="validade" type="date" className="entrada-texto" defaultValue={valores.validade ?? ""} /></div>
      <div className="campo c2"><label htmlFor={id("ctr")}>Contrato</label>
        <select id={id("ctr")} name="contratoId" className="entrada-texto" defaultValue={valores.contratoId ?? ""}>
          <option value="">Da obra</option>
          {opcoes.contratos.map((k) => <option key={k.id} value={k.id}>{k.numero}</option>)}
        </select></div>

      {exigencias.length > 0 && (
        <div className="campo c4"><label htmlFor={id("exi")}>Atende à exigência</label>
          <select id={id("exi")} name="exigencia" className="entrada-texto" value={exigencia}
            onChange={(e) => {
              setExigencia(e.target.value);
              const x = exigencias.find((y) => y.valor === e.target.value);
              if (x && !tipo) setTipo(x.tipo);
            }}>
            <option value="">Nenhuma</option>
            {exigencias.map((e) => <option key={e.valor} value={e.valor}>{e.rotulo}</option>)}
          </select></div>
      )}
      {art && (
        <>
          <div className="campo c2"><label htmlFor={id("cons")}>Conselho</label>
            <select id={id("cons")} name="conselho" className="entrada-texto" required defaultValue={valores.conselho ?? "CREA"}>
              <option value="CREA">CREA</option><option value="CAU">CAU</option><option value="CFT">CFT</option>
            </select></div>
          <div className="campo c3"><label htmlFor={id("prof")}>Profissional</label>
            <input id={id("prof")} name="profissional" className="entrada-texto" required defaultValue={valores.profissional ?? ""} /></div>
          <div className="campo c3"><label htmlFor={id("reg")}>Registro no conselho</label>
            <input id={id("reg")} name="registro" className="entrada-texto" defaultValue={valores.registro ?? ""} /></div>
          <div className="campo c12"><label htmlFor={id("ativ")}>Atividade técnica</label>
            <input id={id("ativ")} name="atividade" className="entrada-texto" defaultValue={valores.atividade ?? ""} placeholder="Execução de obra de edificação, 1.250 m²" /></div>
        </>
      )}
    </>
  );
}
