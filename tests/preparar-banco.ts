import { migrar } from "../scripts/migrar";

/** Recria o banco de testes do zero antes de cada execução. Nunca toca no banco principal. */
export default async function preparar() {
  try { process.loadEnvFile(".env"); } catch {}
  const url = process.env.DATABASE_URL_TESTE;
  if (!url) throw new Error("DATABASE_URL_TESTE não configurada. Copie .env.example para .env.");
  if (url === process.env.DATABASE_URL) throw new Error("O banco de testes não pode ser o mesmo do sistema.");
  await migrar(url, { recriar: true });
  process.env.DATABASE_URL = url;
}
