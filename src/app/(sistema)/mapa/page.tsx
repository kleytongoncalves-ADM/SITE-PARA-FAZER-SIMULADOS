import type { Metadata } from "next";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { mapaObras } from "@/servicos/mapa";
import { MapaObras } from "./MapaObras";

export const metadata: Metadata = { title: "Mapa das obras" };

export default async function PaginaMapa() {
  const a = comoAtor(await exigirUsuario());
  const m = await mapaObras(a);
  const localizadas = m.obras.filter((o) => o.latitude != null && o.longitude != null).length;
  return (
    <>
      <div className="cabecalho">
        <div>
          <div className="sobretitulo">Visão geral</div>
          <h1 className="titulo">Mapa das obras</h1>
          <p className="subtitulo">{localizadas} de {m.obras.length} {m.obras.length === 1 ? "obra localizada" : "obras localizadas"}.</p>
        </div>
      </div>
      <MapaObras obras={m.obras} comSemaforo={m.comSemaforo} podeEditar={m.podeEditar} camadas={process.env.MAPA_CAMADAS ?? null} />
    </>
  );
}
