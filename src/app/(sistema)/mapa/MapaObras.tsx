"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Crosshair, LocateFixed, MapPin, X } from "lucide-react";
import type { Map as MapaLeaflet, LayerGroup, Marker } from "leaflet";
import { EtiquetaSituacao } from "@/componentes/Situacao";
import type { ObraNoMapa } from "@/servicos/mapa";
import { ROTULO_SITUACAO, ROTULO_TIPO, type Situacao } from "@/servicos/rotulos";
import { acaoDefinirLocal } from "./acoes";

const CAMADAS_PADRAO = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATRIBUICAO = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';
const CENTRO_RJ: [number, number] = [-22.6, -43.0];

const COR_SITUACAO: Record<Situacao, string> = {
  em_estudo: "#7b8c93", orcada: "#0b7d8a", licitada: "#7a5cc2", contratada: "#7a5cc2", em_execucao: "#f28c28",
  paralisada: "#c23a3a", concluida: "#17834a", recebida_provisoriamente: "#17834a", recebida_definitivamente: "#17834a", cancelada: "#7b8c93",
};
const COR_NIVEL = { verde: "#17834a", amarelo: "#d99a00", vermelho: "#c23a3a" } as const;
const ROTULO_NIVEL = { verde: "Em dia", amarelo: "Atenção", vermelho: "Crítica" } as const;
const SEM_SEMAFORO = "#7b8c93";

const dataBr = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
const pct = (v: number) => `${v.toFixed(1).replace(".", ",")}%`;
const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

type Props = { obras: ObraNoMapa[]; comSemaforo: boolean; podeEditar: boolean; camadas: string | null };

export function MapaObras({ obras, comSemaforo, podeEditar, camadas }: Props) {
  const router = useRouter();
  const caixa = useRef<HTMLDivElement>(null);
  const mapa = useRef<MapaLeaflet | null>(null);
  const grupo = useRef<LayerGroup | null>(null);
  const marcadores = useRef(new Map<string, Marker>());
  const novoPonto = useRef<Marker | null>(null);
  const L = useRef<typeof import("leaflet") | null>(null);
  const [pronto, setPronto] = useState(false);
  const [situacao, setSituacao] = useState<Situacao | "">("");
  const [nivel, setNivel] = useState<"" | "verde" | "amarelo" | "vermelho">("");
  const [corPor, setCorPor] = useState<"situacao" | "semaforo">(comSemaforo ? "semaforo" : "situacao");
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [marcando, setMarcando] = useState<ObraNoMapa | null>(null);
  const [ponto, setPonto] = useState<{ lat: number; lng: number } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, iniciar] = useTransition();

  const situacoes = useMemo(() => [...new Set(obras.map((o) => o.situacao))], [obras]);
  const filtradas = useMemo(() => obras.filter((o) => (!situacao || o.situacao === situacao) && (!nivel || o.nivel === nivel)), [obras, situacao, nivel]);
  const localizadas = filtradas.filter((o) => o.latitude != null && o.longitude != null);
  const semLocal = obras.filter((o) => o.latitude == null || o.longitude == null);
  const cor = (o: ObraNoMapa) => (corPor === "semaforo" ? (o.nivel ? COR_NIVEL[o.nivel] : SEM_SEMAFORO) : COR_SITUACAO[o.situacao]);

  // Monta o mapa uma vez.
  useEffect(() => {
    let vivo = true;
    import("leaflet").then((mod) => {
      if (!vivo || !caixa.current || mapa.current) return;
      L.current = mod;
      const m = mod.map(caixa.current, { zoomControl: true, attributionControl: true }).setView(CENTRO_RJ, 8);
      mod.tileLayer(camadas || CAMADAS_PADRAO, { maxZoom: 19, attribution: ATRIBUICAO }).addTo(m);
      m.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noreferrer">Leaflet</a>');
      grupo.current = mod.layerGroup().addTo(m);
      mapa.current = m;
      setPronto(true);
    });
    return () => { vivo = false; mapa.current?.remove(); mapa.current = null; };
  }, [camadas]);

  // Marcadores das obras filtradas.
  useEffect(() => {
    const mod = L.current, m = mapa.current, g = grupo.current;
    if (!pronto || !mod || !m || !g) return;
    g.clearLayers();
    marcadores.current.clear();
    for (const o of localizadas) {
      const icone = mod.divIcon({
        className: "marcador-obra", iconSize: [26, 26], iconAnchor: [13, 13], popupAnchor: [0, -12],
        html: `<span style="--c:${cor(o)}"></span>`,
      });
      const mk = mod.marker([o.latitude!, o.longitude!], { icon: icone, title: `${o.codigo} · ${o.nome}`, riseOnHover: true })
        .bindPopup(() => conteudoPopup(o), { maxWidth: 300, minWidth: 220 });
      mk.on("click", () => setSelecionada(o.id));
      mk.addTo(g);
      marcadores.current.set(o.id, mk);
    }
    if (localizadas.length) {
      const b = mod.latLngBounds(localizadas.map((o) => [o.latitude!, o.longitude!] as [number, number]));
      m.fitBounds(b.pad(0.25), { maxZoom: 14 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pronto, filtradas, corPor]);

  // Modo de marcar o local de uma obra.
  useEffect(() => {
    const mod = L.current, m = mapa.current;
    if (!mod || !m) return;
    const el = m.getContainer();
    if (!marcando) { el.classList.remove("mapa-marcando"); novoPonto.current?.remove(); novoPonto.current = null; return; }
    el.classList.add("mapa-marcando");
    const clicar = (e: { latlng: { lat: number; lng: number } }) => {
      setPonto(e.latlng);
      if (!novoPonto.current) {
        novoPonto.current = mod.marker(e.latlng, {
          draggable: true, icon: mod.divIcon({ className: "marcador-obra marcador-novo", iconSize: [30, 30], iconAnchor: [15, 15], html: "<span></span>" }),
        }).addTo(m);
        novoPonto.current.on("dragend", () => setPonto(novoPonto.current!.getLatLng()));
      } else novoPonto.current.setLatLng(e.latlng);
    };
    m.on("click", clicar);
    return () => { m.off("click", clicar); };
  }, [marcando]);

  function focar(o: ObraNoMapa) {
    setSelecionada(o.id);
    const mk = marcadores.current.get(o.id);
    if (mk && mapa.current) { mapa.current.flyTo(mk.getLatLng(), Math.max(mapa.current.getZoom(), 14), { duration: 0.6 }); mk.openPopup(); }
    caixa.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function comecarMarcacao(o: ObraNoMapa) {
    setErro(null); setPonto(null); setMarcando(o);
    mapa.current?.closePopup();
    if (o.latitude != null && o.longitude != null) mapa.current?.flyTo([o.latitude, o.longitude], 16, { duration: 0.6 });
    caixa.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function minhaLocalizacao() {
    navigator.geolocation?.getCurrentPosition(
      (p) => { const ll = { lat: p.coords.latitude, lng: p.coords.longitude }; mapa.current?.flyTo(ll, 17); if (marcando) { setPonto(ll); if (novoPonto.current) novoPonto.current.setLatLng(ll); else if (L.current && mapa.current) { novoPonto.current = L.current.marker(ll, { draggable: true, icon: L.current.divIcon({ className: "marcador-obra marcador-novo", iconSize: [30, 30], iconAnchor: [15, 15], html: "<span></span>" }) }).addTo(mapa.current); novoPonto.current.on("dragend", () => setPonto(novoPonto.current!.getLatLng())); } } },
      () => setErro("Não foi possível obter a localização do aparelho."),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  function salvar() {
    if (!marcando || !ponto) return;
    iniciar(async () => {
      const r = await acaoDefinirLocal(marcando.id, ponto.lat, ponto.lng);
      if (r.erro) { setErro(r.erro); return; }
      setMarcando(null); setPonto(null);
      router.refresh();
    });
  }

  return (
    <div className="mapa-obras">
      <div className="mapa-filtros">
        <div className="chips">
          <button className={`chip ${!situacao ? "chip-ativo" : ""}`} onClick={() => setSituacao("")}>Todas <small className="num">{obras.length}</small></button>
          {situacoes.map((s) => (
            <button key={s} className={`chip ${situacao === s ? "chip-ativo" : ""}`} onClick={() => setSituacao(situacao === s ? "" : s)}>
              <i className="mapa-ponto" style={{ background: COR_SITUACAO[s] }} />{ROTULO_SITUACAO[s]} <small className="num">{obras.filter((o) => o.situacao === s).length}</small>
            </button>
          ))}
        </div>
        {comSemaforo && (
          <div className="chips">
            {(["vermelho", "amarelo", "verde"] as const).map((n) => (
              <button key={n} className={`chip ${nivel === n ? "chip-ativo" : ""}`} onClick={() => setNivel(nivel === n ? "" : n)}>
                <i className="mapa-ponto" style={{ background: COR_NIVEL[n] }} />{ROTULO_NIVEL[n]} <small className="num">{obras.filter((o) => o.nivel === n).length}</small>
              </button>
            ))}
            <span className="mapa-cor-por">
              Cor por
              <button className={`chip ${corPor === "semaforo" ? "chip-ativo" : ""}`} onClick={() => setCorPor("semaforo")}>Semáforo</button>
              <button className={`chip ${corPor === "situacao" ? "chip-ativo" : ""}`} onClick={() => setCorPor("situacao")}>Situação</button>
            </span>
          </div>
        )}
      </div>

      <div className="mapa-grade">
        <section className="cartao mapa-cartao">
          {marcando && (
            <div className="mapa-barra-marcar">
              <Crosshair />
              <span>{ponto ? <>Local de <b>{marcando.codigo}</b> marcado. Arraste o ponto para ajustar.</> : <>Toque no mapa no local de <b>{marcando.codigo} · {marcando.nome}</b>.</>}</span>
              <span style={{ flex: 1 }} />
              <button className="botao botao-neutro botao-pequeno" onClick={minhaLocalizacao}><LocateFixed /> Minha localização</button>
              <button className="botao botao-primario botao-pequeno" onClick={salvar} disabled={!ponto || salvando}>{salvando ? "Salvando…" : "Salvar local"}</button>
              <button className="botao botao-texto botao-pequeno" onClick={() => { setMarcando(null); setPonto(null); setErro(null); }} aria-label="Cancelar"><X /></button>
            </div>
          )}
          {erro && <div className="aviso aviso-erro" style={{ margin: "0 0 10px" }}>{erro}</div>}
          <div ref={caixa} className="mapa-tela" role="region" aria-label="Mapa das obras" />
          <div className="mapa-legenda">
            {corPor === "semaforo"
              ? <>{(["verde", "amarelo", "vermelho"] as const).map((n) => <span key={n}><i className="mapa-ponto" style={{ background: COR_NIVEL[n] }} />{ROTULO_NIVEL[n]}</span>)}<span><i className="mapa-ponto" style={{ background: SEM_SEMAFORO }} />Fora do painel gerencial</span></>
              : situacoes.map((s) => <span key={s}><i className="mapa-ponto" style={{ background: COR_SITUACAO[s] }} />{ROTULO_SITUACAO[s]}</span>)}
          </div>
        </section>

        <aside className="cartao mapa-lista">
          <h2 className="cartao-titulo">Obras no mapa <span className="fraco num">{localizadas.length}</span></h2>
          {localizadas.length === 0 ? <p className="cartao-sub" style={{ marginTop: 8 }}>Nenhuma obra localizada com este filtro.</p> : (
            <ul>
              {localizadas.map((o) => (
                <li key={o.id} className={selecionada === o.id ? "mapa-item-ativo" : ""}>
                  <button className="mapa-item" onClick={() => focar(o)}>
                    <i className="mapa-ponto" style={{ background: cor(o) }} />
                    <span style={{ minWidth: 0 }}>
                      <b>{o.codigo} · {o.nome}</b>
                      <small>{[o.municipio, ROTULO_SITUACAO[o.situacao], o.executadoPct != null ? `${pct(o.executadoPct)} medido` : null].filter(Boolean).join(" · ")}</small>
                    </span>
                  </button>
                  {podeEditar && <button className="botao botao-texto botao-pequeno" onClick={() => comecarMarcacao(o)} aria-label={`Corrigir local de ${o.codigo}`} title="Corrigir local"><MapPin /></button>}
                </li>
              ))}
            </ul>
          )}
          {semLocal.length > 0 && (
            <>
              <h3 className="subtitulo-secao">Sem localização <span className="fraco num">{semLocal.length}</span></h3>
              <ul>
                {semLocal.map((o) => (
                  <li key={o.id}>
                    <div className="mapa-item mapa-item-sem">
                      <span style={{ minWidth: 0 }}>
                        <Link href={`/obras/${o.id}`}><b>{o.codigo} · {o.nome}</b></Link>
                        <small><EtiquetaSituacao situacao={o.situacao} /></small>
                      </span>
                    </div>
                    {podeEditar && <button className="botao botao-neutro botao-pequeno" onClick={() => comecarMarcacao(o)}><MapPin /> Marcar</button>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

/** Conteúdo do balão da obra. Montado com nós de texto: nome e motivos nunca viram HTML. */
function conteudoPopup(o: ObraNoMapa): HTMLElement {
  const el = (tag: string, cls?: string, texto?: string) => { const e = document.createElement(tag); if (cls) e.className = cls; if (texto) e.textContent = texto; return e; };
  const raiz = el("div", "mapa-balao");
  const t = el("a", "mapa-balao-titulo", `${o.codigo} · ${o.nome}`) as HTMLAnchorElement;
  t.href = `/obras/${o.id}`;
  raiz.append(t);
  raiz.append(el("div", "mapa-balao-sub", [ROTULO_TIPO[o.tipo], [o.municipio, o.uf].filter(Boolean).join("/")].filter(Boolean).join(" · ")));
  const linhas = el("dl");
  const par = (k: string, v: string) => { linhas.append(el("dt", undefined, k), el("dd", undefined, v)); };
  par("Situação", ROTULO_SITUACAO[o.situacao]);
  if (o.nivel) par("Semáforo", ROTULO_NIVEL[o.nivel]);
  if (o.contratado != null) par("Contratado", moeda(o.contratado));
  if (o.executadoPct != null) par("Medido", pct(o.executadoPct));
  if (o.ultimoDiario) par("Último diário", dataBr(o.ultimoDiario));
  raiz.append(linhas);
  if (o.motivos.length) {
    const ul = el("ul", "mapa-balao-motivos");
    for (const m of o.motivos) {
      const li = el("li", m.nivel === "vermelho" ? "motivo-vermelho" : "motivo-amarelo");
      const a = el("a", undefined, m.texto) as HTMLAnchorElement;
      a.href = m.href;
      li.append(a);
      ul.append(li);
    }
    raiz.append(ul);
  }
  return raiz;
}
