import { CascaPlataforma } from "@/componentes/CascaPlataforma";
import { exigirDono } from "@/lib/sessao";

export const dynamic = "force-dynamic";

export default async function LayoutPlataforma({ children }: { children: React.ReactNode }) {
  const dono = await exigirDono();
  return <CascaPlataforma nome={dono.nome}>{children}</CascaPlataforma>;
}
