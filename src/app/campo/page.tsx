import type { Metadata } from "next";
import { exigirUsuario } from "@/lib/sessao";
import { DiarioCampo } from "./DiarioCampo";

export const metadata: Metadata = { title: "Diário em campo" };

/**
 * Tela do diário que funciona sem internet. Não leva dados do usuário no HTML:
 * tudo vem do aparelho ou de /campo/dados, para a página poder ficar guardada.
 */
export default async function PaginaCampo() {
  await exigirUsuario();
  return <DiarioCampo />;
}
