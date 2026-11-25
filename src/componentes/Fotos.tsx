"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Camera, MapPin, Trash2 } from "lucide-react";
import { Avisos } from "./Avisos";

type Alvo = { diarioId?: string; naoConformidadeId?: string; ocorrenciaSegurancaId?: string; inspecaoId?: string };

/** Reduz a foto no navegador (lado maior até `max` px) e devolve JPEG. */
async function reduzir(arquivo: File, max: number, qualidade: number) {
  const bmp = await createImageBitmap(arquivo, { imageOrientation: "from-image" } as ImageBitmapOptions);
  const escala = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * escala);
  const h = Math.round(bmp.height * escala);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const blob = await new Promise<Blob>((ok, falha) => canvas.toBlob((b) => (b ? ok(b) : falha(new Error("Não foi possível ler a foto."))), "image/jpeg", qualidade));
  return { blob, w, h };
}

function posicao(): Promise<GeolocationPosition | null> {
  if (!("geolocation" in navigator)) return Promise.resolve(null);
  return new Promise((ok) => navigator.geolocation.getCurrentPosition(ok, () => ok(null), { enableHighAccuracy: true, timeout: 6000, maximumAge: 120000 }));
}

export function EnviarFoto({ obraId, alvo, momento, rotulo = "Adicionar foto", caminho }: { obraId: string; alvo: Alvo; momento?: "antes" | "depois"; rotulo?: string; caminho: string }) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [legenda, setLegenda] = useState("");
  const [estado, setEstado] = useState<{ erro?: string; enviando?: string }>({});

  async function enviar(arquivos: FileList | null) {
    if (!arquivos?.length) return;
    setEstado({ enviando: "Preparando…" });
    const pos = await posicao();
    let n = 0;
    for (const arquivo of Array.from(arquivos)) {
      n++;
      setEstado({ enviando: arquivos.length > 1 ? `Enviando ${n} de ${arquivos.length}…` : "Enviando…" });
      try {
        const grande = await reduzir(arquivo, 1600, 0.82);
        const mini = await reduzir(arquivo, 360, 0.7);
        const f = new FormData();
        f.set("foto", grande.blob, "foto.jpg");
        f.set("miniatura", mini.blob, "mini.jpg");
        f.set("obraId", obraId);
        for (const [k, v] of Object.entries(alvo)) if (v) f.set(k, v);
        if (momento) f.set("momento", momento);
        f.set("legenda", legenda);
        f.set("largura", String(grande.w));
        f.set("altura", String(grande.h));
        f.set("tiradaEm", new Date(arquivo.lastModified || Date.now()).toISOString());
        if (pos) { f.set("latitude", pos.coords.latitude.toFixed(6)); f.set("longitude", pos.coords.longitude.toFixed(6)); }
        f.set("caminho", caminho);
        const r = await fetch("/fotos", { method: "POST", body: f });
        const j = await r.json().catch(() => ({ erro: "Falha no envio." }));
        if (!r.ok) { setEstado({ erro: j.erro ?? "Falha no envio." }); return; }
      } catch (e) {
        setEstado({ erro: e instanceof Error ? e.message : "Falha no envio." });
        return;
      }
    }
    setLegenda("");
    if (entrada.current) entrada.current.value = "";
    setEstado({});
    router.refresh();
  }

  return (
    <div className="enviar-foto">
      <Avisos erro={estado.erro} />
      <div className="form-linha">
        <input className="entrada-texto" style={{ flex: 1, minWidth: 160 }} placeholder="Legenda (opcional)" value={legenda} onChange={(e) => setLegenda(e.target.value)} aria-label="Legenda da foto" />
        <label className={`botao botao-neutro${estado.enviando ? " botao-ocupado" : ""}`}>
          <Camera /> {estado.enviando ?? rotulo}
          <input ref={entrada} type="file" accept="image/*" capture="environment" multiple hidden disabled={!!estado.enviando} onChange={(e) => enviar(e.target.files)} />
        </label>
      </div>
    </div>
  );
}

export type FotoGaleria = { id: string; legenda: string | null; tiradaEm: Date | string | null; latitude: number | null; longitude: number | null; por: string | null };

const quando = (v: Date | string | null) => v ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(v)) : null;

export function Galeria({ fotos, excluir }: { fotos: FotoGaleria[]; excluir?: (id: string) => Promise<{ erro?: string }> }) {
  const router = useRouter();
  const [erro, setErro] = useState<string>();
  if (!fotos.length) return null;
  return (
    <>
      <Avisos erro={erro} />
      <ul className="galeria">
        {fotos.map((f) => (
          <li key={f.id}>
            <a href={`/fotos/${f.id}`} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/fotos/${f.id}?mini`} alt={f.legenda ?? "Foto"} loading="lazy" />
            </a>
            <div className="galeria-legenda">
              {f.legenda && <b>{f.legenda}</b>}
              <span className="num">{quando(f.tiradaEm)}{f.por ? ` · ${f.por}` : ""}</span>
              {f.latitude != null && f.longitude != null && (
                <a href={`https://www.google.com/maps?q=${f.latitude},${f.longitude}`} target="_blank" rel="noreferrer" className="galeria-local"><MapPin /> {f.latitude.toFixed(5)}, {f.longitude.toFixed(5)}</a>
              )}
            </div>
            {excluir && (
              <button type="button" className="galeria-excluir" aria-label="Excluir foto" title="Excluir foto"
                onClick={async () => { if (!window.confirm("Excluir esta foto?")) return; const r = await excluir(f.id); if (r.erro) setErro(r.erro); else router.refresh(); }}>
                <Trash2 />
              </button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
