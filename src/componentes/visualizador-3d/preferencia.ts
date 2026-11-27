"use client";

import { useSyncExternalStore } from "react";

const EVENTO = "civiobras:preferencia";

/** Preferência simples guardada neste navegador ("1" ou "0"). No servidor vale o padrão. */
export function usePreferencia(chave: string, padrao: boolean): [boolean, (v: boolean) => void] {
  const valor = useSyncExternalStore(
    (avisar) => { window.addEventListener(EVENTO, avisar); window.addEventListener("storage", avisar); return () => { window.removeEventListener(EVENTO, avisar); window.removeEventListener("storage", avisar); }; },
    () => { try { const v = window.localStorage.getItem(chave); return v == null ? padrao : v === "1"; } catch { return padrao; } },
    () => padrao,
  );
  const definir = (v: boolean) => {
    try { window.localStorage.setItem(chave, v ? "1" : "0"); } catch { /* sem armazenamento */ }
    window.dispatchEvent(new Event(EVENTO));
  };
  return [valor, definir];
}
