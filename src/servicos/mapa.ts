import { comContexto, ErroDeRegra } from "../lib/db";
import { ctxCampo, obraNoAcesso, obrasVisiveis, uuid } from "./campo";
import { painelGerencial, type Motivo, type Nivel } from "./gerencial";
import type { Ator } from "./obras";
import { exigir, pode } from "./permissoes";
import type { Situacao, TipoObra } from "./rotulos";

export type ObraNoMapa = {
  id: string; codigo: string; nome: string; tipo: TipoObra; situacao: Situacao;
  municipio: string | null; uf: string | null; endereco: string | null;
  latitude: number | null; longitude: number | null;
  ultimoDiario: string | null;
  nivel: Nivel | null; motivos: Motivo[]; executadoPct: number | null; contratado: number | null;
};
export type MapaObras = { obras: ObraNoMapa[]; comSemaforo: boolean; podeEditar: boolean };

/** Todas as obras no acesso do usuário, com o local e a situação. O semáforo vem do painel gerencial, para quem o vê. */
export async function mapaObras(a: Ator): Promise<MapaObras> {
  const comSemaforo = pode(a, "gerencial.ver");
  const painel = comSemaforo ? await painelGerencial(a) : null;
  const porId = new Map((painel?.obras ?? []).map((o) => [o.id, o]));
  const linhas = await comContexto(ctxCampo(a), async (c) => {
    const v = obrasVisiveis(a, "o.id", 1);
    return (await c.query(
      `select o.id, o.codigo, o.nome, o.tipo, o.situacao, o.municipio, o.uf, o.endereco,
              o.latitude::float8 as latitude, o.longitude::float8 as longitude,
              ${pode(a, "diario.ver") ? "(select to_char(max(d.data), 'YYYY-MM-DD') from diario d where d.obra_id = o.id)" : "null::text"} as "ultimoDiario"
         from obra o where o.situacao <> 'cancelada' and ${v.sql} order by o.codigo`, v.params)).rows;
  });
  return {
    comSemaforo,
    podeEditar: pode(a, "obra.editar"),
    obras: linhas.map((l) => {
      const g = porId.get(l.id);
      return {
        ...l,
        nivel: g?.nivel ?? null, motivos: g?.motivos.slice(0, 3) ?? [],
        executadoPct: g && g.contratado > 0 ? g.executadoPct : null, contratado: g && g.contratado > 0 ? g.contratado : null,
      };
    }),
  };
}

/** Coordenadas aceitas: dentro do Brasil, com folga. */
export function localValido(lat: number, lon: number) {
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -34.5 && lat <= 6 && lon >= -74.5 && lon <= -28.5;
}

/** Marca a obra no mapa. */
export async function definirLocal(a: Ator, obraId: string, lat: number, lon: number) {
  exigir(a, "obra.editar");
  if (!uuid(obraId)) throw new ErroDeRegra("Obra não encontrada.");
  if (!localValido(lat, lon)) throw new ErroDeRegra("O ponto marcado fica fora do Brasil.");
  await comContexto(ctxCampo(a), async (c) => {
    await obraNoAcesso(c, a, obraId);
    await c.query("update obra set latitude = $2, longitude = $3 where id = $1", [obraId, Math.round(lat * 1e6) / 1e6, Math.round(lon * 1e6) / 1e6]);
  });
}
