import { notFound } from "next/navigation";
import { ErroDeRegra } from "@/lib/db";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { obterObra } from "@/servicos/obras";

/** Carrega a obra respeitando o acesso do usuário. Fora do acesso, responde "não encontrada". */
export async function carregarObra(id: string) {
  const ator = comoAtor(await exigirUsuario());
  try {
    return { ator, obra: await obterObra(ator, id) };
  } catch (e) {
    if (e instanceof ErroDeRegra) notFound();
    throw e;
  }
}
