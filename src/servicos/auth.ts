import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { pool } from "../lib/db";
import { SENHA_MAX, SENHA_MIN, type Perfil } from "./rotulos";

export type UsuarioLogado = {
  id: string;
  orgaoId: string;
  orgaoNome: string;
  nome: string;
  email: string;
  perfil: Perfil;
  administrador: boolean;
};

const HORAS_SESSAO = 8;
const MAX_TENTATIVAS = 5;
const MINUTOS_BLOQUEIO = 15;

export function gerarHashSenha(senha: string): string {
  const sal = randomBytes(16);
  const hash = scryptSync(senha, sal, 64);
  return `scrypt$${sal.toString("hex")}$${hash.toString("hex")}`;
}

export function conferirSenha(senha: string, guardado: string): boolean {
  const [algoritmo, salHex, hashHex] = guardado.split("$");
  if (algoritmo !== "scrypt" || !salHex || !hashHex) return false;
  const esperado = Buffer.from(hashHex, "hex");
  const obtido = scryptSync(senha, Buffer.from(salHex, "hex"), esperado.length);
  return timingSafeEqual(esperado, obtido);
}

export function validarSenhaNova(senha: string): string | null {
  if (senha.length < SENHA_MIN || senha.length > SENHA_MAX) return `A senha precisa ter de ${SENHA_MIN} a ${SENHA_MAX} caracteres.`;
  if (!/[a-zA-Z]/.test(senha)) return "A senha precisa ter uma letra.";
  if (!/[0-9]/.test(senha)) return "A senha precisa ter números.";
  if (!/[^a-zA-Z0-9\s]/.test(senha)) return "A senha precisa ter um caractere especial.";
  return null;
}

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export type ResultadoLogin =
  | { ok: true; token: string; expiraEm: Date; usuario: UsuarioLogado }
  | { ok: false; motivo: "credenciais" | "bloqueado" | "inativo" };

export async function entrar(email: string, senha: string): Promise<ResultadoLogin> {
  const db = pool();
  const r = await db.query(
    `select u.id, u.orgao_id, o.nome as orgao_nome, u.nome, u.email, u.perfil, u.administrador,
            u.senha_hash, u.ativo, o.ativo as orgao_ativo, u.tentativas_falhas, u.bloqueado_ate
       from usuario u join orgao o on o.id = u.orgao_id
      where lower(u.email) = lower($1)`,
    [email.trim()],
  );
  const u = r.rows[0];
  if (!u) {
    // Gasta o mesmo tempo de uma conferência real, para não revelar se o e-mail existe.
    scryptSync(senha, "sal-fixo-para-tempo", 64);
    return { ok: false, motivo: "credenciais" };
  }
  if (u.bloqueado_ate && new Date(u.bloqueado_ate) > new Date()) return { ok: false, motivo: "bloqueado" };
  if (!conferirSenha(senha, u.senha_hash)) {
    const tentativas = u.tentativas_falhas + 1;
    const bloquear = tentativas >= MAX_TENTATIVAS;
    await db.query(
      `update usuario set tentativas_falhas = $2,
              bloqueado_ate = case when $3 then now() + ($4 || ' minutes')::interval else bloqueado_ate end
        where id = $1`,
      [u.id, bloquear ? 0 : tentativas, bloquear, String(MINUTOS_BLOQUEIO)],
    );
    return { ok: false, motivo: bloquear ? "bloqueado" : "credenciais" };
  }
  if (!u.ativo || !u.orgao_ativo) return { ok: false, motivo: "inativo" };

  const token = randomBytes(32).toString("base64url");
  const expiraEm = new Date(Date.now() + HORAS_SESSAO * 3600 * 1000);
  await db.query("update usuario set tentativas_falhas = 0, bloqueado_ate = null where id = $1", [u.id]);
  await db.query("insert into sessao (token_hash, usuario_id, expira_em) values ($1, $2, $3)", [hashToken(token), u.id, expiraEm]);
  return {
    ok: true,
    token,
    expiraEm,
    usuario: {
      id: u.id, orgaoId: u.orgao_id, orgaoNome: u.orgao_nome, nome: u.nome, email: u.email,
      perfil: u.perfil, administrador: u.administrador,
    },
  };
}

export async function usuarioDaSessao(token: string | undefined): Promise<UsuarioLogado | null> {
  if (!token) return null;
  const r = await pool().query(
    `select u.id, u.orgao_id, o.nome as orgao_nome, u.nome, u.email, u.perfil, u.administrador
       from sessao s join usuario u on u.id = s.usuario_id join orgao o on o.id = u.orgao_id
      where s.token_hash = $1 and s.expira_em > now() and u.ativo and o.ativo`,
    [hashToken(token)],
  );
  const u = r.rows[0];
  if (!u) return null;
  return {
    id: u.id, orgaoId: u.orgao_id, orgaoNome: u.orgao_nome, nome: u.nome, email: u.email,
    perfil: u.perfil, administrador: u.administrador,
  };
}

export async function sair(token: string | undefined) {
  if (token) await pool().query("delete from sessao where token_hash = $1", [hashToken(token)]);
}

export async function encerrarSessoesDoUsuario(usuarioId: string) {
  await pool().query("delete from sessao where usuario_id = $1", [usuarioId]);
}
