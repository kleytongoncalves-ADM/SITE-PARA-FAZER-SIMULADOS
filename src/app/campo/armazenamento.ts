"use client";

import type { DadosCampo } from "@/servicos/diario-campo";

/** Linha do diário guardada no aparelho (o id é só para a tela). */
export type LinhaLocal =
  | { id: string; tipo: "efetivo"; funcao: string; empresa: string; quantidade: number }
  | { id: string; tipo: "equipamento"; descricao: string; quantidade: number; horas: number | null }
  | { id: string; tipo: "servico"; descricao: string; local: string; atividadeId: string | null; avancoPct: number | null }
  | { id: string; tipo: "ocorrencia"; subtipo: "ocorrencia" | "visita" | "paralisacao"; descricao: string; motivo: string | null; horas: number | null };

export type EstadoLancamento = "rascunho" | "pendente" | "enviado" | "conflito" | "recusado";

export type Lancamento = {
  chave: string; usuarioId: string; obraId: string; obraCodigo: string; obraNome: string; data: string;
  registradoEm: string; alteradoEm: string;
  climaManha: string; climaTarde: string; condicao: string; relato: string;
  linhas: LinhaLocal[]; assinar: boolean; comoComplemento: boolean;
  estado: EstadoLancamento; mensagem?: string; diarioId?: string; numero?: number; assinado?: boolean; enviadoEm?: string;
};

const BANCO = "civiobras-campo";

function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, falha) => {
    const r = indexedDB.open(BANCO, 1);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains("dados")) db.createObjectStore("dados");
      if (!db.objectStoreNames.contains("lancamentos")) db.createObjectStore("lancamentos", { keyPath: "chave" });
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => falha(r.error);
  });
}

async function operar<T>(loja: string, modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await abrir();
  try {
    return await new Promise<T | undefined>((ok, falha) => {
      const t = db.transaction(loja, modo);
      const req = fn(t.objectStore(loja));
      t.oncomplete = () => ok(req ? req.result : undefined);
      t.onerror = () => falha(t.error);
      t.onabort = () => falha(t.error);
    });
  } finally {
    db.close();
  }
}

export const lerDados = () => operar<DadosCampo>("dados", "readonly", (s) => s.get("atual"));
export const gravarDados = (d: DadosCampo) => operar("dados", "readwrite", (s) => { s.put(d, "atual"); });
export const listarLancamentos = async () => (await operar<Lancamento[]>("lancamentos", "readonly", (s) => s.getAll())) ?? [];
export const gravarLancamento = (l: Lancamento) => operar("lancamentos", "readwrite", (s) => { s.put(l); });
export const apagarLancamento = (chave: string) => operar("lancamentos", "readwrite", (s) => { s.delete(chave); });

/** Pede ao navegador para não apagar os dados do aparelho quando faltar espaço. */
export async function pedirArmazenamentoPersistente() {
  try { await navigator.storage?.persist?.(); } catch { /* sem suporte */ }
}
