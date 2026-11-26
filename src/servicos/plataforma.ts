import { randomBytes, scryptSync } from "node:crypto";
import { comContexto, conferirPapelDoBanco, ErroDeRegra, pool } from "../lib/db";
import { conferirSenha, encerrarSessoesDoUsuario, gerarHashSenha, hashToken, validarSenhaNova } from "./auth";
import { DadosInvalidos } from "./obras";
import { PERFIS, type Perfil } from "./rotulos";

/**
 * Administração da plataforma: o dono do CiviObras cadastra empresas e os
 * funcionários de cada uma. Tem login e sessão próprios, separados do sistema.
 */

export type Dono = { id: string; nome: string; email: string };

const HORAS_SESSAO = 8;
const MAX_TENTATIVAS = 5;
const MINUTOS_BLOQUEIO = 15;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const ESFERAS = ["empresa_privada", "municipal", "estadual", "federal", "empresa_publica"] as const;
export type Esfera = (typeof ESFERAS)[number];
export const ROTULO_ESFERA: Record<Esfera, string> = {
  empresa_privada: "Empresa privada",
  municipal: "Prefeitura / órgão municipal",
  estadual: "Órgão estadual",
  federal: "Órgão federal",
  empresa_publica: "Empresa pública",
};

// ---------------------------------------------------------------------------
// Login do dono da plataforma
// ---------------------------------------------------------------------------

export type ResultadoEntradaDono =
  | { ok: true; token: string; expiraEm: Date; dono: Dono }
  | { ok: false; motivo: "credenciais" | "bloqueado" };

export async function entrarPlataforma(email: string, senha: string): Promise<ResultadoEntradaDono> {
  const db = pool();
  const r = await db.query(
    "select id, nome, email, senha_hash, ativo, tentativas_falhas, bloqueado_ate from dono_plataforma where lower(email) = lower($1)",
    [email.trim()],
  );
  const d = r.rows[0];
  if (!d || !d.ativo) {
    scryptSync(senha, "sal-fixo-para-tempo", 64);
    return { ok: false, motivo: "credenciais" };
  }
  if (d.bloqueado_ate && new Date(d.bloqueado_ate) > new Date()) return { ok: false, motivo: "bloqueado" };
  if (!conferirSenha(senha, d.senha_hash)) {
    const tentativas = d.tentativas_falhas + 1;
    const bloquear = tentativas >= MAX_TENTATIVAS;
    await db.query(
      `update dono_plataforma set tentativas_falhas = $2,
              bloqueado_ate = case when $3 then now() + ($4 || ' minutes')::interval else bloqueado_ate end
        where id = $1`,
      [d.id, bloquear ? 0 : tentativas, bloquear, String(MINUTOS_BLOQUEIO)],
    );
    return { ok: false, motivo: bloquear ? "bloqueado" : "credenciais" };
  }
  const token = randomBytes(32).toString("base64url");
  const expiraEm = new Date(Date.now() + HORAS_SESSAO * 3600 * 1000);
  await db.query("update dono_plataforma set tentativas_falhas = 0, bloqueado_ate = null where id = $1", [d.id]);
  await db.query("insert into sessao_plataforma (token_hash, dono_id, expira_em) values ($1, $2, $3)", [hashToken(token), d.id, expiraEm]);
  return { ok: true, token, expiraEm, dono: { id: d.id, nome: d.nome, email: d.email } };
}

export async function donoDaSessao(token: string | undefined): Promise<Dono | null> {
  if (!token) return null;
  const r = await pool().query(
    `select d.id, d.nome, d.email from sessao_plataforma s join dono_plataforma d on d.id = s.dono_id
      where s.token_hash = $1 and s.expira_em > now() and d.ativo`,
    [hashToken(token)],
  );
  return (r.rows[0] as Dono) ?? null;
}

export async function sairPlataforma(token: string | undefined) {
  if (token) await pool().query("delete from sessao_plataforma where token_hash = $1", [hashToken(token)]);
}

// ---------------------------------------------------------------------------
// Empresas
// ---------------------------------------------------------------------------

export type EmpresaResumo = {
  id: string; nome: string; cnpj: string | null; esfera: Esfera; uf: string; municipio: string | null;
  ativo: boolean; criadoEm: Date; funcionarios: number; ativos: number; porCargo: Partial<Record<Perfil, number>>;
};

export type DadosEmpresa = { nome: string; cnpj?: string; esfera: string; uf: string; municipio?: string };

function formatarCnpj(valor: string): string | null {
  const d = valor.replace(/\D/g, "");
  if (d.length !== 14) return null;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function validarEmpresa(d: DadosEmpresa) {
  const erros: Record<string, string> = {};
  const nome = d.nome.trim();
  const uf = d.uf.trim().toUpperCase();
  const cnpjTexto = (d.cnpj ?? "").trim();
  const cnpj = cnpjTexto ? formatarCnpj(cnpjTexto) : null;
  if (nome.length < 2) erros.nome = "Informe o nome da empresa.";
  if (cnpjTexto && !cnpj) erros.cnpj = "O CNPJ precisa ter 14 números.";
  if (!ESFERAS.includes(d.esfera as Esfera)) erros.esfera = "Escolha o tipo.";
  if (!/^[A-Z]{2}$/.test(uf)) erros.uf = "Informe a UF com duas letras.";
  if (Object.keys(erros).length) throw new DadosInvalidos(erros);
  return { nome, cnpj, esfera: d.esfera, uf, municipio: d.municipio?.trim() || null };
}

const SQL_EMPRESAS = `
  select o.id, o.nome, o.cnpj, o.esfera, o.uf, o.municipio, o.ativo, o.criado_em as "criadoEm",
         coalesce(u.funcionarios, 0) as funcionarios, coalesce(u.ativos, 0) as ativos, coalesce(u."porCargo", '{}') as "porCargo"
    from orgao o
    left join lateral (
      select count(*)::int as funcionarios,
             count(*) filter (where ativo)::int as ativos,
             (select coalesce(jsonb_object_agg(x.perfil, x.n), '{}')
                from (select perfil, count(*)::int as n from usuario where orgao_id = o.id and ativo group by perfil) x) as "porCargo"
        from usuario where orgao_id = o.id
    ) u on true`;

export async function listarEmpresas(): Promise<EmpresaResumo[]> {
  await conferirPapelDoBanco();
  const r = await pool().query(`${SQL_EMPRESAS} order by o.ativo desc, o.nome`);
  return r.rows as EmpresaResumo[];
}

/** Uma empresa só, sem carregar o quadro inteiro. */
export async function obterEmpresa(id: string): Promise<EmpresaResumo | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  await conferirPapelDoBanco();
  const r = await pool().query(`${SQL_EMPRESAS} where o.id = $1`, [id]);
  return (r.rows[0] as EmpresaResumo) ?? null;
}

export async function criarEmpresa(dono: Dono, d: DadosEmpresa): Promise<string> {
  const v = validarEmpresa(d);
  await conferirPapelDoBanco();
  const r = await pool()
    .query("insert into orgao (nome, cnpj, esfera, uf, municipio) values ($1, $2, $3, $4, $5) returning id", [
      v.nome, v.cnpj, v.esfera, v.uf, v.municipio,
    ])
    .catch((e) => {
      if (e?.code === "23505") throw new DadosInvalidos({ cnpj: "Já existe uma empresa com este CNPJ." });
      throw e;
    });
  void dono;
  return r.rows[0].id;
}

export async function alterarEmpresa(dono: Dono, id: string, d: DadosEmpresa) {
  const v = validarEmpresa(d);
  void dono;
  const r = await pool()
    .query("update orgao set nome = $2, cnpj = $3, esfera = $4, uf = $5, municipio = $6 where id = $1", [
      id, v.nome, v.cnpj, v.esfera, v.uf, v.municipio,
    ])
    .catch((e) => {
      if (e?.code === "23505") throw new DadosInvalidos({ cnpj: "Já existe uma empresa com este CNPJ." });
      throw e;
    });
  if (!r.rowCount) throw new ErroDeRegra("Empresa não encontrada.");
}

/** Desativar a empresa tira o acesso de todos os funcionários dela, sem apagar nada. */
export async function definirEmpresaAtiva(dono: Dono, id: string, ativo: boolean) {
  void dono;
  const r = await pool().query("update orgao set ativo = $2 where id = $1", [id, ativo]);
  if (!r.rowCount) throw new ErroDeRegra("Empresa não encontrada.");
  if (!ativo) {
    await pool().query("delete from sessao where usuario_id in (select id from usuario where orgao_id = $1)", [id]);
  }
}

// ---------------------------------------------------------------------------
// Funcionários de uma empresa
// ---------------------------------------------------------------------------

export type Funcionario = {
  id: string; nome: string; email: string; perfil: Perfil; administrador: boolean; ativo: boolean;
  registroProfissional: string | null; bloqueado: boolean;
};

export type DadosFuncionario = {
  nome: string; email: string; perfil: string; administrador?: boolean; registroProfissional?: string;
};

const ctxDono = (dono: Dono, orgaoId: string) => ({ usuarioId: null, orgaoId, operadorId: dono.id });

function validarFuncionario(d: DadosFuncionario, erros: Record<string, string> = {}) {
  if (d.nome.trim().length < 2) erros.nome = "Informe o nome.";
  if (!EMAIL.test(d.email.trim())) erros.email = "Informe um e-mail válido.";
  if (!PERFIS.includes(d.perfil as Perfil)) erros.perfil = "Escolha o cargo.";
  return erros;
}

export async function listarFuncionarios(orgaoId: string): Promise<Funcionario[]> {
  if (!/^[0-9a-f-]{36}$/i.test(orgaoId)) return [];
  await conferirPapelDoBanco();
  const r = await pool().query(
    `select id, nome, email, perfil, administrador, ativo, registro_profissional as "registroProfissional",
            coalesce(bloqueado_ate > now(), false) as bloqueado
       from usuario where orgao_id = $1 order by ativo desc, nome`,
    [orgaoId],
  );
  return r.rows as Funcionario[];
}

export async function criarFuncionario(dono: Dono, orgaoId: string, d: DadosFuncionario & { senha: string }): Promise<string> {
  const erros = validarFuncionario(d);
  const erroSenha = validarSenhaNova(d.senha);
  if (erroSenha) erros.senha = erroSenha;
  if (Object.keys(erros).length) throw new DadosInvalidos(erros);
  return comContexto(ctxDono(dono, orgaoId), async (c) => {
    const o = await c.query("select 1 from orgao where id = $1", [orgaoId]);
    if (!o.rowCount) throw new ErroDeRegra("Empresa não encontrada.");
    const r = await c.query(
      `insert into usuario (orgao_id, nome, email, perfil, administrador, registro_profissional, senha_hash)
       values ($1,$2,$3,$4,$5,$6,$7) returning id`,
      [orgaoId, d.nome.trim(), d.email.trim().toLowerCase(), d.perfil, !!d.administrador,
       d.registroProfissional?.trim() || null, gerarHashSenha(d.senha)],
    );
    return r.rows[0].id as string;
  });
}

export async function alterarFuncionario(dono: Dono, orgaoId: string, usuarioId: string, d: DadosFuncionario) {
  const erros = validarFuncionario(d);
  if (Object.keys(erros).length) throw new DadosInvalidos(erros);
  await comContexto(ctxDono(dono, orgaoId), async (c) => {
    const r = await c.query(
      `update usuario set nome = $3, email = $4, perfil = $5, administrador = $6, registro_profissional = $7
        where id = $1 and orgao_id = $2`,
      [usuarioId, orgaoId, d.nome.trim(), d.email.trim().toLowerCase(), d.perfil, !!d.administrador,
       d.registroProfissional?.trim() || null],
    );
    if (!r.rowCount) throw new ErroDeRegra("Funcionário não encontrado.");
  });
}

export async function definirFuncionarioAtivo(dono: Dono, orgaoId: string, usuarioId: string, ativo: boolean) {
  await comContexto(ctxDono(dono, orgaoId), async (c) => {
    const r = await c.query("update usuario set ativo = $3 where id = $1 and orgao_id = $2", [usuarioId, orgaoId, ativo]);
    if (!r.rowCount) throw new ErroDeRegra("Funcionário não encontrado.");
  });
  if (!ativo) await encerrarSessoesDoUsuario(usuarioId);
}

/** Troca a senha, desbloqueia o acesso e encerra as sessões abertas. */
export async function redefinirSenha(dono: Dono, orgaoId: string, usuarioId: string, senha: string) {
  const erroSenha = validarSenhaNova(senha);
  if (erroSenha) throw new DadosInvalidos({ senha: erroSenha });
  await comContexto(ctxDono(dono, orgaoId), async (c) => {
    const r = await c.query(
      "update usuario set senha_hash = $3, tentativas_falhas = 0, bloqueado_ate = null where id = $1 and orgao_id = $2",
      [usuarioId, orgaoId, gerarHashSenha(senha)],
    );
    if (!r.rowCount) throw new ErroDeRegra("Funcionário não encontrado.");
  });
  await encerrarSessoesDoUsuario(usuarioId);
}

/** O dono troca a própria senha, informando a atual. As outras sessões dele são encerradas. */
export async function trocarSenhaDono(dono: Dono, atual: string, nova: string, tokenAtual?: string) {
  const r = await pool().query("select senha_hash from dono_plataforma where id = $1", [dono.id]);
  if (!r.rows[0] || !conferirSenha(atual, r.rows[0].senha_hash)) throw new DadosInvalidos({ atual: "Senha atual incorreta." });
  const erro = validarSenhaNova(nova);
  if (erro) throw new DadosInvalidos({ nova: erro });
  await pool().query("update dono_plataforma set senha_hash = $2 where id = $1", [dono.id, gerarHashSenha(nova)]);
  await pool().query("delete from sessao_plataforma where dono_id = $1 and token_hash <> $2", [dono.id, tokenAtual ? hashToken(tokenAtual) : ""]);
}
