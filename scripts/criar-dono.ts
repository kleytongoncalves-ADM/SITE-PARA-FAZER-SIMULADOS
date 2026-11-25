/**
 * Cria (ou atualiza a senha de) o dono da plataforma. Não existe cadastro público:
 * este é o único jeito de criar o primeiro acesso à área /plataforma.
 *
 *   NOME="Fulano" EMAIL="fulano@exemplo.com" SENHA="Teste@123" npm run criar-dono
 */
import { Client } from "pg";
import { gerarHashSenha, validarSenhaNova } from "../src/servicos/auth";

async function principal() {
  process.loadEnvFile?.(".env");
  const url = process.env.DATABASE_URL;
  const nome = (process.env.NOME ?? "").trim();
  const email = (process.env.EMAIL ?? "").trim().toLowerCase();
  const senha = process.env.SENHA ?? "";
  if (!url) throw new Error("DATABASE_URL não configurada.");
  if (nome.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Informe NOME e EMAIL.");
  const erro = validarSenhaNova(senha);
  if (erro) throw new Error(erro);
  const c = new Client({ connectionString: url });
  await c.connect();
  try {
    await c.query(
      `insert into dono_plataforma (nome, email, senha_hash) values ($1, $2, $3)
       on conflict (lower(email)) do update set nome = excluded.nome, senha_hash = excluded.senha_hash, ativo = true,
         tentativas_falhas = 0, bloqueado_ate = null`,
      [nome, email, gerarHashSenha(senha)],
    );
    console.log(`Dono da plataforma pronto: ${email}. Entre em /plataforma/entrar.`);
  } finally {
    await c.end();
  }
}

principal().catch((e) => { console.error(e.message); process.exit(1); });
