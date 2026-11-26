"use server";

import { headers } from "next/headers";
import { ErroDeRegra } from "@/lib/db";
import { declinar, enviarProposta, salvarRascunho, type DadosProposta } from "@/servicos/cotacoes";

type Retorno = { erro?: string; ok?: string };

async function rede() {
  const h = await headers();
  return (h.get("x-nf-client-connection-ip") ?? h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim() || null;
}

async function executar(fn: (r: string | null) => Promise<unknown>): Promise<Retorno> {
  try {
    await fn(await rede());
    return {};
  } catch (e) {
    if (e instanceof ErroDeRegra) return { erro: e.message };
    throw e;
  }
}

export const acaoEnviarProposta = async (token: string, d: DadosProposta) => executar((r) => enviarProposta(token, d, r));
export const acaoSalvarRascunho = async (token: string, d: DadosProposta) => executar((r) => salvarRascunho(token, d, r));
export const acaoDeclinar = async (token: string, motivo: string) => executar((r) => declinar(token, motivo, r));
