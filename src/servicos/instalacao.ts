import { timingSafeEqual } from "node:crypto";
import { conferirPapelDoBanco, ErroDeRegra, pool } from "../lib/db";
import { gerarHashSenha, validarSenhaNova } from "./auth";

export type DadosInstalacao = { nome: string; email: string; senha: string };

/** Verdadeiro enquanto a plataforma não tem dono: o sistema ainda não foi instalado. */
export async function precisaInstalar(): Promise<boolean> {
  const r = await pool().query("select not exists (select 1 from dono_plataforma) as vazio");
  return r.rows[0].vazio;
}

function codigoConfere(informado: string): boolean {
  const esperado = process.env.CODIGO_INSTALACAO ?? "";
  if (!esperado) {
    if (process.env.NODE_ENV === "production") {
      throw new ErroDeRegra("A instalação está fechada: defina a variável CODIGO_INSTALACAO na hospedagem e tente de novo.");
    }
    return true;
  }
  const a = Buffer.from(informado);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Primeiro acesso: cria o dono da plataforma, que depois cadastra as empresas
 * e os funcionários em /plataforma. Só funciona uma vez e exige o código de instalação.
 */
export async function instalar(dados: DadosInstalacao, codigo: string): Promise<void> {
  if (!codigoConfere(codigo)) throw new ErroDeRegra("Código de instalação incorreto.");
  const nome = dados.nome.trim();
  const email = dados.email.trim().toLowerCase();
  if (nome.length < 3) throw new ErroDeRegra("Informe o seu nome.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ErroDeRegra("Informe um e-mail válido.");
  const erroSenha = validarSenhaNova(dados.senha);
  if (erroSenha) throw new ErroDeRegra(erroSenha);

  await conferirPapelDoBanco();
  const hash = gerarHashSenha(dados.senha);
  const c = await pool().connect();
  try {
    await c.query("begin");
    // Trava para duas pessoas não instalarem ao mesmo tempo.
    await c.query("select pg_advisory_xact_lock(74100001)");
    const vazio = await c.query("select not exists (select 1 from dono_plataforma) as vazio");
    if (!vazio.rows[0].vazio) throw new ErroDeRegra("O sistema já foi instalado. Entre com o seu e-mail e a sua senha.");
    await c.query("insert into dono_plataforma (nome, email, senha_hash) values ($1, $2, $3)", [nome, email, hash]);
    await c.query("commit");
  } catch (erro) {
    await c.query("rollback").catch(() => {});
    throw erro;
  } finally {
    c.release();
  }
}
