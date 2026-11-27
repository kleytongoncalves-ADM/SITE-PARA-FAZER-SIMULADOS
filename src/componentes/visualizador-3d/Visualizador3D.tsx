"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Box, ChevronLeft, ChevronRight, Coins, Download, Eraser, Focus, Hammer, LocateFixed, Map as IconePlanta, Maximize, Maximize2, Minimize, Minus, Plus, Ruler, Table2, Tags } from "lucide-react";
import type { CenaItem, Deposito, Peca } from "@/servicos/cena-3d";
import type { Apontado, Filtro, Medida, Motor, Vista } from "./motor";
import { EVENTO_LOCALIZAR } from "./Localizar3D";

type Props = {
  orcamentoId: string;
  cena: CenaItem[];
  /** canteiro: todos os itens, por etapa. painel: um item por vez, ao lado da planilha. */
  modo: "canteiro" | "painel";
  focoInicial?: string | null;
  /** Canteiro: tudo o que foi comprado, somado e arrumado por área. */
  deposito?: Deposito;
};

const chaveVistos = (id: string) => `civiobras:3d:vistos:${id}`;

function ler(chave: string): string | null {
  try { return window.localStorage.getItem(chave); } catch { return null; }
}
function gravar(chave: string, valor: string) {
  try { window.localStorage.setItem(chave, valor); } catch { /* navegador sem armazenamento */ }
}

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const ROTULO_PAPEL: Record<Peca["papel"], string> = { kit: "Serviço montado", material: "Material", equipamento: "Equipamento", mao_de_obra: "Equipe" };

type FiltroTela = "todos" | "material" | "mao_de_obra" | "equipamento" | "kit" | "selecionado" | "custo";
const FILTROS: { id: FiltroTela; nome: string }[] = [
  { id: "todos", nome: "Todos" }, { id: "material", nome: "Materiais" }, { id: "mao_de_obra", nome: "Mão de obra" },
  { id: "equipamento", nome: "Equipamentos" }, { id: "kit", nome: "Serviços" }, { id: "selecionado", nome: "Item selecionado" }, { id: "custo", nome: "Maior custo" },
];
const VISTAS: { id: Vista; nome: string }[] = [
  { id: "perspectiva", nome: "Perspectiva" }, { id: "superior", nome: "Superior" }, { id: "frente", nome: "Frontal" }, { id: "lado", nome: "Lateral" },
];
const num = (v: number, casas = 2) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const custoDe = (i: CenaItem, papel?: Peca["papel"]) => i.pecas.reduce((t, p) => t + (p.papel !== "kit" && (!papel || p.papel === papel) ? p.custo ?? 0 : 0), 0);

export function Visualizador3D({ orcamentoId, cena, modo, focoInicial, deposito }: Props) {
  const caixa = useRef<HTMLDivElement>(null);
  const motor = useRef<Motor | null>(null);
  const [pronto, setPronto] = useState(false);
  const [falhou, setFalhou] = useState(false);
  const [selecionado, setSelecionado] = useState<string | null>(() => focoInicial ?? cena.at(-1)?.itemId ?? null);
  const [focado, setFocado] = useState(!!focoInicial);
  const vistos = useRef<Set<string> | null>(null);
  const pendentes = useRef<Set<string>>(new Set());
  const [montado, setMontado] = useState(false);
  const [vista, setVista] = useState<Vista>("perspectiva");
  const [filtro, setFiltro] = useState<FiltroTela>("todos");
  const [porCusto, setPorCusto] = useState(false);
  const [etiquetas, setEtiquetas] = useState(true);
  const [medindo, setMedindo] = useState(false);
  const [medida, setMedida] = useState<Medida | null>(null);
  const [apontado, setApontado] = useState<Apontado>(null);
  const [dimensoes, setDimensoes] = useState<[number, number, number] | null>(null);
  const [cheia, setCheia] = useState(false);
  const quadro = useRef<HTMLDivElement>(null);
  const origem = useRef<Record<string, string[]>>({});
  useEffect(() => { origem.current = deposito?.origem ?? {}; }, [deposito]);
  const temKit = useMemo(() => cena.some((i) => i.pecas.some((p) => p.papel === "kit")), [cena]);

  const itemSel = cena.find((i) => i.itemId === selecionado) ?? cena.at(-1) ?? null;
  const indice = itemSel ? cena.indexOf(itemSel) : -1;
  const idSel = itemSel?.itemId ?? null;
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
      m = new mod.Motor(caixa.current, { escuro: escuro(), animacoes: true, onSelecionar: (id) => { setSelecionado(origem.current[id]?.[0] ?? id); setFocado(true); }, onApontar: setApontado, onMedir: setMedida });
      motor.current = m;
      obs = new IntersectionObserver(([e]) => m?.definirVisivel(e.isIntersecting));
      obs.observe(caixa.current);
      tema = new MutationObserver(() => m?.aplicarTema(escuro()));
      tema.observe(document.documentElement, { attributes: true, attributeFilter: ["data-tema"] });
      setPronto(true);
    }).catch(() => setFalhou(true));
    return () => { vivo = false; obs?.disconnect(); tema?.disconnect(); m?.destruir(); motor.current = null; };
  }, []);

  // Atualiza a cena quando os itens, o item escolhido ou a vista mudam.
  useEffect(() => {
    const m = motor.current;
    if (!pronto || !m) return;
    if (modo === "painel") {
      const it = cena.find((i) => i.itemId === idSel);
      const animar = new Set(it && pendentes.current.delete(it.itemId) ? [it.itemId] : []);
      void m.definirCena(it ? [it] : [], "item", { animar, montado });
    } else if (deposito && !montado) {
      // Depósito: anima as entradas dos itens novos; nas que já existiam, só caem as peças acrescentadas.
      const animar = new Set(deposito.entradas.map((e) => e.itemId).filter((id) => deposito.origem[id]?.some((i) => pendentes.current.has(i))));
      pendentes.current.clear();
      const foco = focado && idSel ? deposito.entradas.find((e) => deposito.origem[e.itemId]?.includes(idSel))?.itemId ?? null : null;
      void m.definirCena(deposito.entradas, "canteiro", { foco, animar });
    } else {
      const animar = new Set(cena.map((i) => i.itemId).filter((id) => pendentes.current.delete(id)));
      void m.definirCena(cena, "canteiro", { foco: focado ? idSel : null, animar, montado: true });
    }
  }, [pronto, cena, deposito, idSel, modo, focado, montado]);

  // O que está na cena agora: entradas do depósito ou os itens do orçamento.
  const naCena = useMemo(() => (modo === "canteiro" && deposito && !montado ? deposito.entradas : cena), [modo, deposito, montado, cena]);
  const totalGeral = useMemo(() => cena.reduce((t, i) => t + custoDe(i), 0), [cena]);

  // Filtros e visualização por custo.
  useEffect(() => {
    const m = motor.current;
    if (!pronto || !m || modo !== "canteiro") return;
    let f: Filtro = null;
    if (filtro === "selecionado" && idSel) {
      const ids = new Set(naCena.filter((e) => e.itemId === idSel || deposito?.origem[e.itemId]?.includes(idSel)).map((e) => e.itemId));
      f = (id) => ids.has(id);
    } else if (filtro === "custo") {
      const ordem = [...naCena].sort((a, b) => custoDe(b) - custoDe(a));
      const total = ordem.reduce((t, e) => t + custoDe(e), 0);
      const ids = new Set<string>();
      let soma = 0;
      for (const e of ordem) { if (ids.size && soma >= total * 0.8) break; ids.add(e.itemId); soma += custoDe(e); }
      f = (id) => ids.has(id);
    } else if (filtro !== "todos" && filtro !== "selecionado") f = (_id, papel) => papel === filtro;
    m.destacar(f);
    m.verCusto(porCusto);
  }, [pronto, modo, filtro, porCusto, naCena, idSel, deposito]);

  useEffect(() => { motor.current?.etiquetas(etiquetas); }, [pronto, etiquetas]);
  useEffect(() => { motor.current?.medir(medindo); }, [pronto, medindo]);
  useEffect(() => {
    const aoMudar = () => setCheia(document.fullscreenElement === quadro.current);
    document.addEventListener("fullscreenchange", aoMudar);
    return () => document.removeEventListener("fullscreenchange", aoMudar);
  }, []);

  // Planilha → 3D: o botão da linha chama o item aqui. 3D → planilha: a linha do item escolhido fica marcada.
  useEffect(() => {
    if (modo !== "painel") return;
    const aoLocalizar = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      if (!cena.some((i) => i.itemId === id)) return;
      setSelecionado(id);
      caixa.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    };
    window.addEventListener(EVENTO_LOCALIZAR, aoLocalizar);
    return () => window.removeEventListener(EVENTO_LOCALIZAR, aoLocalizar);
  }, [modo, cena]);
  useEffect(() => {
    if (modo !== "painel" || !idSel) return;
    const linha = document.getElementById(`item-${idSel}`);
    linha?.classList.add("linha-3d");
    return () => linha?.classList.remove("linha-3d");
  }, [modo, idSel]);

  // Dimensões do elemento escolhido, lidas do modelo na cena.
  useEffect(() => {
    if (!pronto || modo !== "canteiro" || !idSel) return;
    const t = window.setTimeout(() => {
      const alvo = naCena.find((e) => e.itemId === idSel || deposito?.origem[e.itemId]?.includes(idSel));
      setDimensoes(alvo ? motor.current?.dimensoes(alvo.itemId) ?? null : null);
    }, 900);
    return () => window.clearTimeout(t);
  }, [pronto, modo, idSel, naCena, deposito]);

  const mudarVista = (v: Vista) => { setVista(v); motor.current?.vista(v); };
  const telaCheia = () => { if (document.fullscreenElement) void document.exitFullscreen(); else void quadro.current?.requestFullscreen?.(); };
  const exportar = () => {
    const url = motor.current?.imagem();
    if (!url) return;
    const a = document.createElement("a");
    a.href = url; a.download = "orcamento-3d.png"; a.click();
  };

  // Cartão do elemento apontado: só dados do orçamento.
  const cartao = useMemo(() => {
    if (!apontado) return null;
    const e = naCena.find((i) => i.itemId === apontado.itemId);
    if (!e) return null;
    const deDeposito = !cena.includes(e);
    const total = custoDe(e);
    const usadoEm = deDeposito ? (deposito?.origem[e.itemId] ?? []).map((id) => cena.find((i) => i.itemId === id)?.numero).filter(Boolean).join(", ") : "";
    return {
      titulo: deDeposito && e.pecas[0]?.papel === "mao_de_obra" ? e.pecas[0].nome.split(":")[0] : e.descricao,
      sub: deDeposito ? ROTULO_PAPEL[e.pecas[0]?.papel ?? "material"] : `Item ${e.numero} · ${e.etapa}`,
      quantidade: deDeposito ? e.pecas[0]?.rotulo ?? "" : `${e.quantidade.toLocaleString("pt-BR", { maximumFractionDigits: 4 })} ${e.unidade}`,
      material: deDeposito ? 0 : custoDe(e, "material"), mao: deDeposito ? 0 : custoDe(e, "mao_de_obra"), equip: deDeposito ? 0 : custoDe(e, "equipamento"),
      total, parte: totalGeral > 0 ? (total / totalGeral) * 100 : 0, usadoEm, parcial: e.semModelo.length > 0,
    };
  }, [apontado, naCena, cena, deposito, totalGeral]);

  const ir = (passo: number) => { if (!cena.length) return; const n = (indice + passo + cena.length) % cena.length; setSelecionado(cena[n].itemId); };


  // Resumo do que está sendo orçado, por tipo de recurso.
  const resumo = useMemo(() => {
    const r = { material: 0, mao_de_obra: 0, equipamento: 0, horas: 0 };
    for (const i of cena) for (const p of i.pecas) {
      if (p.papel === "kit") continue;
      r[p.papel] += p.custo ?? 0;
      if (p.papel === "mao_de_obra" && p.visual.tipo === "figura") r.horas += p.visual.horas;
    }
    return r;
  }, [cena]);

  const palco = (
    <div ref={quadro} className={`v3d-palco ${modo === "painel" ? "v3d-palco-painel" : ""} ${cheia ? "v3d-palco-cheio" : ""}`}>
      <div ref={caixa} className="v3d-cena" aria-label="Vista 3D" role="img" />
      {!pronto && !falhou && <div className="v3d-aviso">Carregando modelos…</div>}
      {falhou && <div className="v3d-aviso">Este navegador não abre a vista 3D.</div>}
      {pronto && cena.length === 0 && <div className="v3d-aviso">Inclua itens para ver o orçamento em 3D.</div>}
      {pronto && itemSel && itemSel.pecas.length === 0 && modo === "painel" && <div className="v3d-aviso">Item sem modelo 3D.</div>}
      {modo === "canteiro" && pronto && cena.length > 0 && (
        <div className="v3d-resumo">
          <div><span>Materiais</span><b className="num">{moeda(resumo.material)}</b></div>
          <div><span>Equipe · {resumo.horas.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} h</span><b className="num">{moeda(resumo.mao_de_obra)}</b></div>
          <div><span>Equipamentos</span><b className="num">{moeda(resumo.equipamento)}</b></div>
          {!montado && deposito && (
            <p><i className="v3d-abc v3d-abc-a" />Maior custo<i className="v3d-abc v3d-abc-b" />Médio<i className="v3d-abc v3d-abc-c" />Menor</p>
          )}
        </div>
      )}
      {cartao && apontado && (
        <div className="v3d-cartao" style={{ left: apontado.x, top: apontado.y }}>
          <span className="fraco">{cartao.sub}</span>
          <b>{cartao.titulo}</b>
          <dl>
            <div><dt>Quantidade</dt><dd className="num">{cartao.quantidade}</dd></div>
            {cartao.material > 0 && <div><dt>Materiais</dt><dd className="num">{moeda(cartao.material)}</dd></div>}
            {cartao.mao > 0 && <div><dt>Mão de obra</dt><dd className="num">{moeda(cartao.mao)}</dd></div>}
            {cartao.equip > 0 && <div><dt>Equipamentos</dt><dd className="num">{moeda(cartao.equip)}</dd></div>}
            {cartao.total > 0 && <div className="v3d-cartao-total"><dt>{cartao.parcial ? "Total com modelo" : "Custo direto"}</dt><dd className="num">{moeda(cartao.total)} · {num(cartao.parte, 1)}%</dd></div>}
            {cartao.usadoEm && <div><dt>Itens</dt><dd className="num">{cartao.usadoEm}</dd></div>}
          </dl>
        </div>
      )}
      {modo === "canteiro" && pronto && cena.length > 0 && (
        <>
          <div className="v3d-ferramentas">
            <div className="v3d-grupo">
              <button type="button" className="v3d-botao" onClick={() => motor.current?.zoom(0.75)} title="Aproximar" aria-label="Aproximar"><Plus /></button>
              <button type="button" className="v3d-botao" onClick={() => motor.current?.zoom(1.35)} title="Afastar" aria-label="Afastar"><Minus /></button>
            </div>
            <div className="v3d-grupo">
              <button type="button" className={`v3d-botao ${medindo ? "v3d-botao-ativo" : ""}`} onClick={() => setMedindo(!medindo)} aria-pressed={medindo} title="Medir" aria-label="Medir"><Ruler /></button>
              <button type="button" className={`v3d-botao ${porCusto ? "v3d-botao-ativo" : ""}`} onClick={() => setPorCusto(!porCusto)} aria-pressed={porCusto} title="Visualizar por custo" aria-label="Visualizar por custo"><Coins /></button>
              <button type="button" className={`v3d-botao ${etiquetas ? "" : "v3d-botao-ativo"}`} onClick={() => setEtiquetas(!etiquetas)} aria-pressed={!etiquetas} title={etiquetas ? "Ocultar etiquetas" : "Mostrar etiquetas"} aria-label={etiquetas ? "Ocultar etiquetas" : "Mostrar etiquetas"}><Tags /></button>
              <button type="button" className="v3d-botao" onClick={exportar} title="Exportar imagem" aria-label="Exportar imagem"><Download /></button>
              <button type="button" className="v3d-botao" onClick={telaCheia} title={cheia ? "Sair da tela cheia" : "Tela cheia"} aria-label={cheia ? "Sair da tela cheia" : "Tela cheia"}>{cheia ? <Minimize /> : <Maximize />}</button>
            </div>
          </div>
          <div className="v3d-vistas">
            <div className="v3d-grupo">
              <button type="button" className={`v3d-botao ${vista !== "planta" ? "v3d-botao-ativo" : ""}`} onClick={() => mudarVista("perspectiva")}><Box /><span>Vista 3D</span></button>
              <button type="button" className={`v3d-botao ${vista === "planta" ? "v3d-botao-ativo" : ""}`} onClick={() => mudarVista("planta")}><IconePlanta /><span>Planta</span></button>
            </div>
            {vista !== "planta" && (
              <div className="v3d-grupo">
                {VISTAS.map((v) => <button key={v.id} type="button" className={`v3d-botao v3d-botao-texto ${vista === v.id ? "v3d-botao-marcado" : ""}`} onClick={() => mudarVista(v.id)}>{v.nome}</button>)}
              </div>
            )}
          </div>
          <div className="v3d-filtros" role="group" aria-label="Filtros" hidden={medindo}>
            {FILTROS.filter((f) => f.id !== "kit" || (temKit && montado)).map((f) => (
              <button key={f.id} type="button" className={`v3d-filtro ${filtro === f.id ? "v3d-filtro-ativo" : ""}`} onClick={() => setFiltro(f.id)} aria-pressed={filtro === f.id}>{f.nome}</button>
            ))}
          </div>
          {medindo && (
            <div className="v3d-medicao">
              {!medida ? <span>Clique em dois pontos para medir a distância. Com três ou mais, a área.</span> : (
                <>
                  <div><span>{medida.pontos >= 3 ? "Perímetro" : "Distância"}</span><b className="num">{num(medida.comprimento)} m</b></div>
                  {medida.area != null && <div><span>Área</span><b className="num">{num(medida.area)} m²</b></div>}
                  {medida.desnivel > 0.01 && <div><span>Desnível</span><b className="num">{num(medida.desnivel)} m</b></div>}
                  <button type="button" className="v3d-botao" onClick={() => motor.current?.limparMedida()} title="Limpar medição" aria-label="Limpar medição"><Eraser /></button>
                </>
              )}
            </div>
          )}
        </>
      )}
      <div className="v3d-controles">
        <button type="button" className="v3d-botao" onClick={() => { setFocado(false); motor.current?.centralizar(); }} disabled={!pronto} title="Centralizar obra" aria-label="Centralizar obra"><Focus /></button>
        {modo === "canteiro" && <button type="button" className="v3d-botao" onClick={() => { if (!idSel) return; const alvo = naCena.find((e) => e.itemId === idSel || deposito?.origem[e.itemId]?.includes(idSel)); if (alvo) motor.current?.focar(alvo.itemId); }} disabled={!pronto || !idSel} title="Centralizar item" aria-label="Centralizar item"><LocateFixed /></button>}
        {temKit && (
          <button type="button" className={`v3d-botao ${montado ? "v3d-botao-ativo" : ""}`} onClick={() => setMontado(!montado)} aria-pressed={montado} disabled={!pronto}>
            <Hammer /><span>Serviço montado</span>
          </button>
        )}
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
      {itemSel.pecas.length > 0 && (
        <ul className="v3d-pecas">
          {itemSel.pecas.map((p) => (
            <li key={`${p.codigo}-${p.papel}`} className="v3d-peca">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/biblioteca-3d/miniaturas/${p.codigo}.png`} alt="" width={44} height={44} loading="lazy" />
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
      {itemSel.pecas.length === 0 && <p className="fraco v3d-sem-modelo">Representação 3D indisponível para este item.</p>}
      {itemSel.pecas.length > 0 && itemSel.semModelo.length > 0 && <p className="fraco v3d-sem-modelo">Sem modelo 3D: {itemSel.semModelo.join(", ").toLowerCase()}.</p>}
      {modo === "canteiro" && (
        <div className="v3d-detalhe-rodape">
          {dimensoes && <span className="fraco num" title="Espaço que o item ocupa na cena">{num(dimensoes[0])} × {num(dimensoes[2])} × {num(dimensoes[1])} m</span>}
          <Link href={`/orcamentos/${orcamentoId}#item-${itemSel.itemId}`} className="botao botao-texto botao-pequeno"><Table2 /> Ver na planilha</Link>
        </div>
      )}
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
