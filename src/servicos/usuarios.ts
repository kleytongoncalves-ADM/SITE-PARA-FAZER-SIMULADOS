import { comContexto, ErroDeRegra } from "../lib/db";
import { encerrarSessoesDoUsuario, gerarHashSenha, validarSenhaNova } from "./auth";
import { DadosInvalidos, type Ator } from "./obras";
import { exigir } from "./permissoes";
import { PERFIS, type Perfil } from "./rotulos";

export type UsuarioLista = {
  id: string; nome: string; email: string; perfil: Perfil; administrador: boolean; ativo: boolean;
  registroProfissional: string | null;
};

export type DadosUsuario = {
  nome: string; email: string; perfil: Perfil; administrador?: boolean;
  registroProfissional?: string | null; senha: string;
};

const ctx = (a: Ator) => ({ usuarioId: a.id, orgaoId: a.orgaoId });

export async function listarUsuarios(a: Ator, opcoes: { somenteAtivos?: boolean } = {}): Promise<UsuarioLista[]> {
  return comContexto(ctx(a), async (c) => {
    const r = await c.query(
      `select id, nome, email, perfil, administrador, ativo, registro_profissional as "registroProfissional"
         from usuario where orgao_id = $1 ${opcoes.somenteAtivos ? "and ativo" : ""} order by nome`,
      [a.orgaoId],
    );
    return r.rows as UsuarioLista[];
  });
}

export async function criarUsuario(a: Ator, d: DadosUsuario): Promise<string> {
  exigir(a, "usuario.gerenciar");
  const erros: Record<string, string> = {};
  if (!d.nome.trim()) erros.nome = "Informe o nome.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) erros.email = "Informe um e-mail válido.";
  if (!PERFIS.includes(d.perfil)) erros.perfil = "Escolha o perfil.";
  const erroSenha = validarSenhaNova(d.senha);
  if (erroSenha) erros.senha = erroSenha;
  if (Object.keys(erros).length) throw new DadosInvalidos(erros);
  return comContexto(ctx(a), async (c) => {
    const r = await c.query(
      `insert into usuario (orgao_id, nome, email, perfil, administrador, registro_profissional, senha_hash)
       values ($1,$2,$3,$4,$5,$6,$7) returning id`,
      [a.orgaoId, d.nome.trim(), d.email.trim().toLowerCase(), d.perfil, !!d.administrador,
       d.registroProfissional?.trim() || null, gerarHashSenha(d.senha)],
    );
    return r.rows[0].id as string;
  });
}

export async function definirAtivo(a: Ator, usuarioId: string, ativo: boolean) {
  exigir(a, "usuario.gerenciar");
  if (usuarioId === a.id && !ativo) throw new ErroDeRegra("Você não pode desativar o seu próprio acesso.");
  await comContexto(ctx(a), async (c) => {
    const r = await c.query("update usuario set ativo = $3 where id = $1 and orgao_id = $2", [usuarioId, a.orgaoId, ativo]);
    if (!r.rowCount) throw new ErroDeRegra("Usuário não encontrado.");
  });
  if (!ativo) await encerrarSessoesDoUsuario(usuarioId);
}
