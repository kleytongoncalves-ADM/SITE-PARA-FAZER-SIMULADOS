"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Focus, Maximize2, Pause, Play } from "lucide-react";
import type { CenaItem, Peca } from "@/servicos/cena-3d";
import type { Motor } from "./motor";
import { usePreferencia } from "./preferencia";

type Props = {
  orcamentoId: string;
  cena: CenaItem[];
  /** canteiro: todos os itens, por etapa. painel: um item por vez, ao lado da planilha. */
  modo: "canteiro" | "painel";
  focoInicial?: string | null;
};

const CHAVE_ANIM = "civiobras:3d:animacoes";
const chaveVistos = (id: string) => `civiobras:3d:vistos:${id}`;

function ler(chave: string): string | null {
  try { return window.localStorage.getItem(chave); } catch { return null; }
}
function gravar(chave: string, valor: string) {
  try { window.localStorage.setItem(chave, valor); } catch { /* navegador sem armazenamento */ }
}

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const ROTULO_PAPEL: Record<Peca["papel"], string> = { kit: "Serviço montado", material: "Material", equipamento: "Equipamento", mao_de_obra: "Equipe" };

export function Visualizador3D({ orcamentoId, cena, modo, focoInicial }: Props) {
  const caixa = useRef<HTMLDivElement>(null);
  const motor = useRef<Motor | null>(null);
  const [pronto, setPronto] = useState(false);
  const [falhou, setFalhou] = useState(false);
  const [animacoes, setAnimacoes] = usePreferencia(CHAVE_ANIM, true);
  const [materiais, setMateriais] = useState(false);
  const [selecionado, setSelecionado] = useState<string | null>(() => focoInicial ?? cena.at(-1)?.itemId ?? null);
  const [focado, setFocado] = useState(!!focoInicial);
  const vistos = useRef<Set<string> | null>(null);
  const pendentes = useRef<Set<string>>(new Set());

  const itemSel = cena.find((i) => i.itemId === selecionado) ?? cena.at(-1) ?? null;
  const indice = itemSel ? cena.indexOf(itemSel) : -1;
  const comModelo = useMemo(() => cena.filter((i) => i.pecas.length > 0).length, [cena]);

  // Itens novos desde a última visita (ou desde a última inclusão): tocam a animação de entrada.
  useEffect(() => {
    const ids = cena.map((i) => i.itemId);
    if (!vistos.current) {
      const salvo = ler(chaveVistos(orcamentoId));
      vistos.current = salvo ? new Set(JSON.parse(salvo) as string[]) : null;
      if (!vistos.current) { vistos.current = new Set(ids); gravar(chaveVistos(orcamentoId), JSON.stringify(ids)); return; }
    }
    const novos = ids.filter((id) => !vistos.current!.has(id));
    vistos.current = new Set(ids);
    gravar(chaveVistos(orcamentoId), JSON.stringify(ids));
    if (novos.length) {
      novos.forEach((id) => pendentes.current.add(id));
      setSelecionado(novos.at(-1)!);
      setFocado(true);
    }
  }, [cena, orcamentoId]);

  // Cria o motor 3D só no navegador; o Three.js não entra no carregamento da página.
  useEffect(() => {
    let vivo = true;
    let m: Motor | null = null;
    let obs: IntersectionObserver | null = null;
    let tema: MutationObserver | null = null;
    import("./motor").then((mod) => {
      if (!vivo || !caixa.current) return;
      if (!mod.suporteWebGL()) { setFalhou(true); return; }
      const escuro = () => document.documentElement.dataset.tema === "escuro";
      m = new mod.Motor(caixa.current, { escuro: escuro(), animacoes: ler(CHAVE_ANIM) !== "0", onSelecionar: (id) => { setSelecionado(id); setFocado(true); } });
      motor.current = m;
      obs = new IntersectionObserver(([e]) => m?.definirVisivel(e.isIntersecting));
      obs.observe(caixa.current);
      tema = new MutationObserver(() => m?.aplicarTema(escuro()));
      tema.observe(document.documentElement, { attributes: true, attributeFilter: ["data-tema"] });
      setPronto(true);
    }).catch(() => setFalhou(true));
    return () => { vivo = false; obs?.disconnect(); tema?.disconnect(); m?.destruir(); motor.current = null; };
  }, []);

  useEffect(() => { motor.current?.definirAnimacoes(animacoes); }, [animacoes]);

  // Atualiza a cena quando os itens, o item escolhido ou a vista mudam.
  const idSel = itemSel?.itemId ?? null;
  useEffect(() => {
    const m = motor.current;
    if (!pronto || !m) return;
    const naCena = modo === "painel" ? cena.filter((i) => i.itemId === idSel) : cena;
    const animar = new Set(naCena.map((i) => i.itemId).filter((id) => pendentes.current.has(id)));
    animar.forEach((id) => pendentes.current.delete(id));
    if (modo === "painel") {
      const it = naCena[0];
      void m.definirCena(it ? [it] : [], "item", { animar, materiais });
    } else {
      void m.definirCena(cena, "canteiro", { foco: focado ? idSel : null, animar });
    }
  }, [pronto, cena, idSel, modo, materiais, focado]);

  const tocar = () => { motor.current?.tocar(idSel ?? undefined); };
  const tocarTudo = () => { motor.current?.tocar(); };
  const alternarAnimacoes = () => setAnimacoes(!animacoes);
  const ir = (passo: number) => { if (!cena.length) return; const n = (indice + passo + cena.length) % cena.length; setSelecionado(cena[n].itemId); };

  const temKit = !!itemSel?.pecas.some((p) => p.papel === "kit");
  const temMateriais = !!itemSel?.pecas.some((p) => p.papel === "material");

  const palco = (
    <div className={`v3d-palco ${modo === "painel" ? "v3d-palco-painel" : ""}`}>
      <div ref={caixa} className="v3d-cena" aria-label="Vista 3D" role="img" />
      {!pronto && !falhou && <div className="v3d-aviso">Carregando modelos…</div>}
      {falhou && <div className="v3d-aviso">Este navegador não abre a vista 3D.</div>}
      {pronto && cena.length === 0 && <div className="v3d-aviso">Inclua itens para ver o orçamento em 3D.</div>}
      {pronto && itemSel && itemSel.pecas.length === 0 && modo === "painel" && <div className="v3d-aviso">Item sem modelo 3D.</div>}
      <div className="v3d-controles">
        <button type="button" className="v3d-botao" onClick={tocar} disabled={!pronto || !itemSel} title="Tocar animação do item"><Play /><span>Animar</span></button>
        {modo === "canteiro" && <button type="button" className="v3d-botao" onClick={tocarTudo} disabled={!pronto} title="Animar todos os itens"><Play /><span>Animar tudo</span></button>}
        <button type="button" className="v3d-botao" onClick={() => { setFocado(false); motor.current?.centralizar(); }} disabled={!pronto} title="Centralizar" aria-label="Centralizar"><Focus /></button>
        <button type="button" className={`v3d-botao ${animacoes ? "" : "v3d-botao-desligado"}`} onClick={alternarAnimacoes} aria-pressed={animacoes} title={animacoes ? "Desligar animação ao incluir item" : "Ligar animação ao incluir item"} aria-label="Animação ao incluir item">
          {animacoes ? <Pause /> : <Play />}
        </button>
      </div>
    </div>
  );

  const detalhe = itemSel && (
    <div className="v3d-detalhe">
      <div className="v3d-detalhe-topo">
        <span className="fraco num">Item {itemSel.numero} · {itemSel.etapa}</span>
        <b>{itemSel.descricao}</b>
        <span className="num fraco">{itemSel.quantidade.toLocaleString("pt-BR", { maximumFractionDigits: 4 })} {itemSel.unidade}</span>
      </div>
      {modo === "painel" && temKit && temMateriais && (
        <div className="chips">
          <button type="button" className={`chip ${!materiais ? "chip-ativo" : ""}`} onClick={() => setMateriais(false)}>Serviço</button>
          <button type="button" className={`chip ${materiais ? "chip-ativo" : ""}`} onClick={() => setMateriais(true)}>Materiais</button>
        </div>
      )}
      {itemSel.pecas.length > 0 && (
        <ul className="v3d-pecas">
          {itemSel.pecas.map((p) => (
            <li key={`${p.codigo}-${p.papel}`} className="v3d-peca">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/biblioteca-3d/miniaturas/${p.codigo}.webp`} alt="" width={44} height={44} loading="lazy" />
              <div>
                <span className="fraco">{ROTULO_PAPEL[p.papel]}</span>
                <b>{p.papel === "mao_de_obra" ? p.nome.split(":")[0] : p.origem}</b>
              </div>
              <div className="dir">
                <b className="num">{p.rotulo}</b>
                {p.custo != null && p.papel !== "kit" && <span className="fraco num">{moeda(p.custo)}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {itemSel.semModelo.length > 0 && <p className="fraco v3d-sem-modelo">Sem modelo 3D: {itemSel.semModelo.join(", ").toLowerCase()}.</p>}
    </div>
  );

  if (modo === "painel") {
    return (
      <section className="cartao v3d v3d-painel surgir" aria-label="Vista 3D do item">
        <div className="v3d-cabecalho">
          <h2 className="cartao-titulo">Vista 3D</h2>
          <div className="v3d-navegar">
            <button type="button" className="botao botao-texto botao-pequeno" onClick={() => ir(-1)} disabled={cena.length < 2} aria-label="Item anterior"><ChevronLeft /></button>
            <span className="num fraco">{indice + 1} de {cena.length}</span>
            <button type="button" className="botao botao-texto botao-pequeno" onClick={() => ir(1)} disabled={cena.length < 2} aria-label="Próximo item"><ChevronRight /></button>
            <Link href={`/orcamentos/${orcamentoId}/3d${idSel ? `?item=${idSel}` : ""}`} className="botao botao-neutro botao-pequeno"><Maximize2 /> Canteiro</Link>
          </div>
        </div>
        <div className="v3d-corpo">
          {palco}
          {detalhe}
        </div>
      </section>
    );
  }

  return (
    <div className="v3d v3d-canteiro">
      <section className="cartao v3d-quadro surgir">
        {palco}
      </section>
      <aside className="cartao v3d-lateral surgir" style={{ "--i": 1 } as React.CSSProperties}>
        {detalhe}
        <div className="v3d-lista-titulo"><b>Itens</b><span className="fraco num">{comModelo} de {cena.length} com modelo</span></div>
        <ol className="v3d-lista">
          {cena.map((i) => (
            <li key={i.itemId}>
              <button type="button" className={`v3d-lista-item ${i.itemId === idSel ? "v3d-lista-ativo" : ""}`} onClick={() => { setSelecionado(i.itemId); setFocado(true); }}>
                <span className="num fraco">{i.numero}</span>
                <span className="v3d-lista-texto">{i.descricao}</span>
                {i.pecas.length === 0 && <span className="etiqueta et-neutra">Sem 3D</span>}
              </button>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}
