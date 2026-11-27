"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Box, Building2, ChevronLeft, ChevronRight, Coins, Download, Eraser, Focus, Hammer, LocateFixed, Map as IconePlanta, Maximize, Maximize2, Minimize, Minus, Plus, Ruler, Table2, Tags } from "lucide-react";
import type { CenaItem, Deposito, Peca } from "@/servicos/cena-3d";
import type { Apontado, Filtro, Medida, Motor, Vista } from "./motor";
import { EVENTO_LOCALIZAR } from "./Localizar3D";
import { papelNaObra, type MedidaItem, type Obra } from "@/servicos/obra-3d";
import { acaoMedidas3d } from "@/app/(sistema)/orcamentos/acoes";
import { BotaoEnviar, FormAcao } from "@/componentes/FormAcao";

type Props = {
  orcamentoId: string;
  cena: CenaItem[];
  /** canteiro: todos os itens, por etapa. painel: um item por vez, ao lado da planilha. */
  modo: "canteiro" | "painel";
  focoInicial?: string | null;
  /** Canteiro: o que cada item do orçamento compra, arrumado por item. */
  deposito?: Deposito;
  /** Obra desenhada a partir dos itens com medidas. */
  obra?: Obra;
  medidas?: Record<string, MedidaItem>;
  podeMedir?: boolean;
};
const NOME_PAPEL = { alvenaria: "Alvenaria", camada: "Revestimento de parede", fundacao: "Fundação", pilar: "Pilar", cinta: "Cinta ou viga", piso: "Piso", cobertura: "Cobertura" } as const;
const br = (v: number | null | undefined) => (v == null ? "" : v.toLocaleString("pt-BR", { maximumFractionDigits: 3 }));

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
const num = (v: number, casas = 2) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const custoDe = (i: CenaItem, papel?: Peca["papel"]) => i.pecas.reduce((t, p) => t + (p.papel !== "kit" && (!papel || p.papel === papel) ? p.custo ?? 0 : 0), 0);

export function Visualizador3D({ orcamentoId, cena, modo, focoInicial, deposito, obra, medidas, podeMedir }: Props) {
  const caixa = useRef<HTMLDivElement>(null);
  const motor = useRef<Motor | null>(null);
  const [pronto, setPronto] = useState(false);
  const [falhou, setFalhou] = useState(false);
  const [selecionado, setSelecionado] = useState<string | null>(() => focoInicial ?? cena.at(-1)?.itemId ?? null);
  const [focado, setFocado] = useState(!!focoInicial);
  const vistos = useRef<Set<string> | null>(null);
  const pendentes = useRef<Set<string>>(new Set());
  const [montado, setMontado] = useState(false);
  const temObra = !!obra && obra.locais.length > 0;
  const [verObra, setVerObra] = useState(false);
  const naObra = modo === "canteiro" && temObra && verObra;
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
    if (naObra && obra) {
      const custos = Object.fromEntries(cena.map((i) => [i.itemId, custoDe(i)]));
      m.definirObra(obra.locais, custos, { foco: focado ? idSel : null });
    } else if (modo === "painel") {
      const it = cena.find((i) => i.itemId === idSel);
      const animar = new Set(it && pendentes.current.delete(it.itemId) ? [it.itemId] : []);
      void m.definirCena(it ? [it] : [], "item", { animar, montado });
    } else if (deposito && !montado) {
      // Depósito: anima as entradas dos itens novos; nas que já existiam, só caem as peças acrescentadas.
      const animar = new Set(deposito.entradas.map((e) => e.itemId).filter((id) => deposito.origem[id]?.some((i) => pendentes.current.has(i))));
      pendentes.current.clear();
      const foco = focado && idSel ? deposito.entradas.find((e) => deposito.origem[e.itemId]?.includes(idSel))?.itemId ?? null : null;
      void m.definirCena(deposito.entradas, "canteiro", { foco, animar, montado: true });
    } else {
      const animar = new Set(cena.map((i) => i.itemId).filter((id) => pendentes.current.delete(id)));
      void m.definirCena(cena, "canteiro", { foco: focado ? idSel : null, animar, montado: true });
    }
  }, [pronto, cena, deposito, idSel, modo, focado, montado, naObra, obra]);

  // O que está na cena agora: entradas do depósito ou os itens do orçamento.
  const naCena = useMemo(() => (modo === "canteiro" && deposito && !montado && !naObra ? deposito.entradas : cena), [modo, deposito, montado, cena, naObra]);
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

  // Custo do item escolhido, por tipo de recurso, e o peso dele no orçamento.
  const custoSel = useMemo(() => {
    if (!itemSel) return null;
    const total = custoDe(itemSel);
    const partes = ([["material", "Materiais"], ["mao_de_obra", "Mão de obra"], ["equipamento", "Equipamentos"]] as const)
      .map(([id, nome]) => ({ id, nome, valor: custoDe(itemSel, id) })).filter((c) => c.valor > 0);
    return { total, partes, parte: totalGeral > 0 ? (total / totalGeral) * 100 : 0 };
  }, [itemSel, totalGeral]);
  const maiorCusto = useMemo(() => Math.max(0, ...cena.map((i) => custoDe(i))), [cena]);

  const ir = (passo: number) => { if (!cena.length) return; const n = (indice + passo + cena.length) % cena.length; setSelecionado(cena[n].itemId); };


  // Resumo do que está sendo orçado, por tipo de recurso.
  const palco = (
    <div ref={quadro} className={`v3d-palco ${modo === "painel" ? "v3d-palco-painel" : ""} ${cheia ? "v3d-palco-cheio" : ""}`}>
      <div ref={caixa} className="v3d-cena" aria-label="Vista 3D" role="img" />
      {!pronto && !falhou && <div className="v3d-aviso">Carregando modelos…</div>}
      {falhou && <div className="v3d-aviso">Este navegador não abre a vista 3D.</div>}
      {pronto && cena.length === 0 && <div className="v3d-aviso">Inclua itens para ver o orçamento em 3D.</div>}
      {pronto && itemSel && itemSel.pecas.length === 0 && modo === "painel" && <div className="v3d-aviso">Item sem modelo 3D.</div>}
      {modo === "canteiro" && deposito && !montado && !naObra && idSel && (
        <style>{`.v3d-palco .v3d-placa[data-bloco="${idSel}"]{display:flex}.v3d-palco .v3d-area-item[data-bloco="${idSel}"]{background:var(--petroleo);color:#fff;border-color:var(--petroleo)}.v3d-palco .v3d-area-item[data-bloco="${idSel}"] span{color:var(--laranja-claro)}.v3d-palco .v3d-area-item[data-bloco="${idSel}"] em{display:block;color:rgba(255,255,255,.85)}`}</style>
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
          </div>
          <div className="v3d-filtros" role="group" aria-label="Filtros" hidden={medindo}>
            {FILTROS.filter((f) => (naObra ? !["material", "mao_de_obra", "equipamento", "kit"].includes(f.id) : f.id !== "kit" || (temKit && montado))).map((f) => (
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
      {modo === "canteiro" && pronto && cena.length > 0 && !naObra && !montado && etiquetas && !medindo && (
        <details className="v3d-legenda">
          <summary>Legenda</summary>
          <ul>
            <li><i className="v3d-leg-mouse" />Mouse: botão esquerdo ou do meio gira, direito arrasta, rolagem aproxima</li>
            <li><i className="v3d-leg-anel" />Anel na base da equipe: horas de trabalho, 24 h por volta</li>
            <li><i className="v3d-leg-a" />Maior peso no custo do orçamento (curva A)</li>
            <li><i className="v3d-leg-b" />Peso intermediário (curva B)</li>
            <li><i className="v3d-leg-c" />Menor peso (curva C)</li>
          </ul>
        </details>
      )}
      <div className="v3d-controles">
        <button type="button" className="v3d-botao" onClick={() => { setFocado(false); motor.current?.centralizar(); }} disabled={!pronto} title="Centralizar obra" aria-label="Centralizar obra"><Focus /></button>
        {modo === "canteiro" && <button type="button" className="v3d-botao" onClick={() => { if (!idSel) return; const alvo = naCena.find((e) => e.itemId === idSel || deposito?.origem[e.itemId]?.includes(idSel)); if (alvo) motor.current?.focar(alvo.itemId); }} disabled={!pronto || !idSel} title="Centralizar item" aria-label="Centralizar item"><LocateFixed /></button>}
        {modo === "canteiro" && temObra && (
          <button type="button" className={`v3d-botao ${naObra ? "v3d-botao-ativo" : ""}`} onClick={() => setVerObra(!verObra)} aria-pressed={naObra} disabled={!pronto}>
            <Building2 /><span>Obra</span>
          </button>
        )}
        {temKit && !naObra && (
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
      {custoSel && custoSel.total > 0 && (
        <div className="v3d-custos">
          <div className="v3d-custos-total"><span>{itemSel.semModelo.length > 0 ? "Total com modelo" : "Custo direto"}</span><b className="num">{moeda(custoSel.total)}</b><span className="fraco num">{num(custoSel.parte, 1)}% do orçamento</span></div>
          <div className="v3d-custos-barra" aria-hidden="true">
            {custoSel.partes.map((c) => <i key={c.id} className={`v3d-cor-${c.id}`} style={{ flexGrow: c.valor }} />)}
          </div>
          <dl>
            {custoSel.partes.map((c) => <div key={c.id}><dt><i className={`v3d-cor-${c.id}`} />{c.nome}</dt><dd className="num">{moeda(c.valor)}</dd></div>)}
          </dl>
        </div>
      )}
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
      {modo === "canteiro" && naObra && obra && !obra.representados.includes(itemSel.itemId) && <p className="fraco v3d-sem-modelo">Representação 3D indisponível para este item.</p>}
      {modo === "canteiro" && medidas && (() => {
        const papel = papelNaObra(itemSel.descricao, itemSel.unidade);
        const m = medidas[itemSel.itemId];
        if (!papel) return null;
        return (
          <FormAcao key={itemSel.itemId} acao={acaoMedidas3d.bind(null, orcamentoId, itemSel.itemId)} className="v3d-medidas" mostrarOk={false}>
            <div className="v3d-medidas-titulo"><b>Medidas na obra</b><span className="fraco">{NOME_PAPEL[papel.papel]}</span></div>
            <label className="v3d-campo v3d-campo-largo"><span>Local</span><input name="local" className="entrada-texto" defaultValue={m?.local ?? itemSel.etapa} placeholder="Muro frontal" disabled={!podeMedir} list="v3d-locais" /></label>
            <label className="v3d-campo"><span>Altura (m)</span><input name="altura" className="entrada-texto num" inputMode="decimal" defaultValue={br(m?.altura)} disabled={!podeMedir} /></label>
            <label className="v3d-campo"><span>Comprimento (m)</span><input name="comprimento" className="entrada-texto num" inputMode="decimal" defaultValue={br(m?.comprimento)} placeholder="Pela quantidade" disabled={!podeMedir} /></label>
            <datalist id="v3d-locais">{[...new Set(Object.values(medidas).map((x) => x.local))].map((l) => <option key={l} value={l} />)}</datalist>
            {podeMedir && (
              <div className="v3d-medidas-acoes">
                <label className="v3d-marcar"><input type="checkbox" name="etapaInteira" defaultChecked={!m} /> Aplicar à etapa inteira</label>
                <BotaoEnviar className="botao botao-primario botao-pequeno" enviando="Salvando…">Salvar</BotaoEnviar>
              </div>
            )}
          </FormAcao>
        );
      })()}
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
        <div className="v3d-lista-titulo"><b>Itens do orçamento</b><span className="fraco num">{comModelo} de {cena.length} com modelo</span></div>
        <ol className="v3d-lista">
          {cena.map((i) => (
            <li key={i.itemId}>
              <button type="button" className={`v3d-lista-item ${i.itemId === idSel ? "v3d-lista-ativo" : ""}`} onClick={() => { setSelecionado(i.itemId); setFocado(true); }}>
                <span className="num fraco">{i.numero}</span>
                <span className="v3d-lista-texto">{i.descricao}<i className="v3d-lista-barra" style={{ width: `${maiorCusto > 0 ? (custoDe(i) / maiorCusto) * 100 : 0}%` }} /></span>
                {i.pecas.length === 0 ? <span className="etiqueta et-neutra">Sem 3D</span> : custoDe(i) > 0 && <span className="num v3d-lista-valor">{moeda(custoDe(i))}</span>}
              </button>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}
