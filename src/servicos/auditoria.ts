import { comContexto } from "../lib/db";
import type { Ator } from "./obras";
import { exigir } from "./permissoes";

export type LinhaAuditoria = {
  id: string; quando: Date; tabela: string; registroId: string; registro: string | null;
  acao: "criou" | "alterou"; campo: string | null; valorAnterior: string | null; valorNovo: string | null;
  autor: string | null;
};

export async function listarAuditoria(a: Ator, filtros: { tabela?: string; registroId?: string } = {}, limite = 200): Promise<LinhaAuditoria[]> {
  exigir(a, "auditoria.ver");
  return comContexto({ usuarioId: a.id, orgaoId: a.orgaoId }, async (c) => {
    const params: unknown[] = [];
    const cond = ["true"];
    if (filtros.tabela && ["obra", "usuario", "vinculo_obra"].includes(filtros.tabela)) {
      params.push(filtros.tabela);
      cond.push(`a.tabela = $${params.length}`);
    }
    if (filtros.registroId && /^[0-9a-f-]{36}$/i.test(filtros.registroId)) {
      params.push(filtros.registroId);
      cond.push(`a.registro_id = $${params.length}`);
    }
    const r = await c.query(
      `select a.id::text, a.quando, a.tabela, a.registro_id as "registroId", a.acao, a.campo,
              coalesce(ua.nome, a.valor_anterior) as "valorAnterior", coalesce(un.nome, a.valor_novo) as "valorNovo", u.nome as autor,
              coalesce(o.codigo || ' · ' || o.nome, us.nome, ov.codigo || ' · ' || uv.nome) as registro
         from auditoria a
         left join usuario u on u.id = a.usuario_id
         left join usuario ua on ua.id::text = a.valor_anterior
         left join usuario un on un.id::text = a.valor_novo
         left join obra o on a.tabela = 'obra' and o.id = a.registro_id
         left join usuario us on a.tabela = 'usuario' and us.id = a.registro_id
         left join vinculo_obra v on a.tabela = 'vinculo_obra' and v.id = a.registro_id
         left join obra ov on ov.id = v.obra_id
         left join usuario uv on uv.id = v.usuario_id
        where ${cond.join(" and ")} order by a.quando desc, a.id desc limit ${Number(limite)}`,
      params,
    );
    return r.rows as LinhaAuditoria[];
  });
}
