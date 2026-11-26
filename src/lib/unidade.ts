/** Unidade de medida como se escreve: m², m³, kg. As bases de preço trazem M2, M3, KG. */
const EXATAS: Record<string, string> = { M: "m", KG: "kg", G: "g", T: "t", UN: "un", H: "h", KM: "km", CM: "cm", MM: "mm", ML: "mL", MES: "mês", L: "L" };

export function unidade(u: string | null | undefined): string {
  const t = (u ?? "").trim();
  if (!t) return "";
  const exata = EXATAS[t.toUpperCase()];
  if (exata) return exata;
  const partes = /^[A-Z0-9]+X[A-Z0-9]+$/.test(t) ? t.split("X") : null;
  if (partes && partes.every((p) => EXATAS[p] || /^M[23]$/.test(p))) return partes.map(unidade).join(" x ");
  return t.replace(/m2(?!\d)/gi, "m²").replace(/m3(?!\d)/gi, "m³");
}
