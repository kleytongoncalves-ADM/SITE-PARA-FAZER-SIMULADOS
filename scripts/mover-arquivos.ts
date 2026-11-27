import { createHash } from "node:crypto";
import { Client } from "pg";
import { armazenamento, ArmazenamentoSupabase, caminhoDoArquivo, extensaoDoMime, type Armazenamento } from "../src/lib/armazenamento";
import { opcoesDeConexao } from "../src/lib/db";

/**
 * Leva para o armazenamento as fotos e versões de documentos que ainda estão
 * dentro do banco.
 *
 * Etapa 1 (padrão): copia cada arquivo, lê de volta, confere o SHA-256 e só
 * então grava o caminho no registro. O conteúdo continua no banco.
 * Etapa 2 (--liberar): para cada registro já copiado, lê o arquivo do
 * armazenamento, confere com o conteúdo do banco e só então apaga o conteúdo do
 * banco. Nada é apagado sem conferência.
 *
 * Pode ser rodado quantas vezes for preciso: retoma de onde parou.
 */
export type Resultado = {
  fotosCopiadas: number; versoesCopiadas: number; fotosLiberadas: number; versoesLiberadas: number;
  falhas: { tabela: string; id: string; motivo: string }[];
  restantes: { fotos: number; versoes: number; bytes: number };
};

const LOTE = 20;
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");

async function conferido(arm: Armazenamento, caminho: string, esperado: string) {
  const lido = await arm.ler(caminho);
  if (!lido) throw new Error("arquivo não encontrado no armazenamento depois do envio");
  if (sha(lido) !== esperado) throw new Error("o arquivo lido do armazenamento não confere com o original");
}

/** Roda a tarefa dentro do contexto de cada órgão, para valer também com o papel comum. */
async function porOrgao<T>(c: Client, fn: (orgaoId: string) => Promise<T>) {
  const orgaos = (await c.query("select id from orgao order by id")).rows.map((r) => r.id as string);
  for (const id of orgaos) {
    await c.query("select set_config('app.orgao_id', $1, false), set_config('app.usuario_id', '', false), set_config('app.operador_id', '', false)", [id]);
    await fn(id);
  }
}

export async function moverArquivos(c: Client, arm: Armazenamento, opcoes: { liberar?: boolean; aviso?: (m: string) => void } = {}): Promise<Resultado> {
  const aviso = opcoes.aviso ?? (() => {});
  const r: Resultado = { fotosCopiadas: 0, versoesCopiadas: 0, fotosLiberadas: 0, versoesLiberadas: 0, falhas: [], restantes: { fotos: 0, versoes: 0, bytes: 0 } };
  const falhou = (tabela: string, id: string, e: unknown) => {
    const motivo = e instanceof Error ? e.message : String(e);
    r.falhas.push({ tabela, id, motivo });
    aviso(`  falha em ${tabela} ${id}: ${motivo}`);
  };

  await porOrgao(c, async (orgaoId) => {
    // ---------------------------------------------------------------- cópia
    const pular: string[] = [];
    for (;;) {
      const fotos = (await c.query(
        `select id, obra_id, mime, conteudo, miniatura from foto
          where orgao_id = $1 and arquivo is null and conteudo is not null and not (id = any($2::uuid[])) order by criado_em, id limit ${LOTE}`,
        [orgaoId, pular])).rows;
      if (!fotos.length) break;
      for (const f of fotos) {
        try {
          const arquivo = caminhoDoArquivo(orgaoId, "fotos", f.obra_id, `${f.id}.${extensaoDoMime(f.mime)}`);
          const mini = caminhoDoArquivo(orgaoId, "fotos", f.obra_id, `${f.id}-miniatura.jpg`);
          await arm.guardar(arquivo, f.conteudo, f.mime);
          await conferido(arm, arquivo, sha(f.conteudo));
          await arm.guardar(mini, f.miniatura, "image/jpeg");
          await conferido(arm, mini, sha(f.miniatura));
          const u = await c.query("update foto set arquivo = $2, arquivo_miniatura = $3 where id = $1 and arquivo is null", [f.id, arquivo, mini]);
          if (u.rowCount) r.fotosCopiadas++;
        } catch (e) {
          pular.push(f.id);
          falhou("foto", f.id, e);
        }
      }
    }
    for (;;) {
      const versoes = (await c.query(
        `select v.id, v.documento_id, d.obra_id, v.mime, v.nome_arquivo, v.sha256, v.conteudo from documento_versao v join documento d on d.id = v.documento_id
          where v.orgao_id = $1 and v.arquivo is null and v.conteudo is not null and not (v.id = any($2::uuid[])) order by v.criado_em, v.id limit ${LOTE}`,
        [orgaoId, pular])).rows;
      if (!versoes.length) break;
      for (const v of versoes) {
        try {
          if (sha(v.conteudo) !== v.sha256) throw new Error("o conteúdo no banco não confere com o SHA-256 registrado");
          const ext = String(v.nome_arquivo).includes(".") ? String(v.nome_arquivo).split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin" : "bin";
          const arquivo = caminhoDoArquivo(orgaoId, "documentos", v.obra_id, v.documento_id, `${v.id}.${ext}`);
          await arm.guardar(arquivo, v.conteudo, v.mime);
          await conferido(arm, arquivo, v.sha256);
          const u = await c.query("update documento_versao set arquivo = $2 where id = $1 and arquivo is null", [v.id, arquivo]);
          if (u.rowCount) r.versoesCopiadas++;
        } catch (e) {
          pular.push(v.id);
          falhou("documento_versao", v.id, e);
        }
      }
    }
    if (!opcoes.liberar) return;

    // ---------------------------------------------------------------- liberação
    for (;;) {
      const fotos = (await c.query(
        `select id, conteudo, miniatura, arquivo, arquivo_miniatura from foto
          where orgao_id = $1 and arquivo is not null and (conteudo is not null or miniatura is not null) and not (id = any($2::uuid[])) order by id limit ${LOTE}`,
        [orgaoId, pular])).rows;
      if (!fotos.length) break;
      for (const f of fotos) {
        try {
          if (f.conteudo) await conferido(arm, f.arquivo, sha(f.conteudo));
          if (f.miniatura) await conferido(arm, f.arquivo_miniatura, sha(f.miniatura));
          await c.query("update foto set conteudo = null, miniatura = null where id = $1 and arquivo is not null", [f.id]);
          r.fotosLiberadas++;
        } catch (e) {
          pular.push(f.id);
          falhou("foto", f.id, e);
        }
      }
    }
    for (;;) {
      const versoes = (await c.query(
        `select id, sha256, conteudo, arquivo from documento_versao
          where orgao_id = $1 and arquivo is not null and conteudo is not null and not (id = any($2::uuid[])) order by id limit ${LOTE}`,
        [orgaoId, pular])).rows;
      if (!versoes.length) break;
      for (const v of versoes) {
        try {
          if (sha(v.conteudo) !== v.sha256) throw new Error("o conteúdo no banco não confere com o SHA-256 registrado");
          await conferido(arm, v.arquivo, v.sha256);
          await c.query("update documento_versao set conteudo = null where id = $1 and arquivo is not null", [v.id]);
          r.versoesLiberadas++;
        } catch (e) {
          pular.push(v.id);
          falhou("documento_versao", v.id, e);
        }
      }
    }
  });

  await porOrgao(c, async (orgaoId) => {
    const q = (await c.query(
      `select (select count(*) from foto where orgao_id = $1 and (conteudo is not null or miniatura is not null))::int as fotos,
              (select count(*) from documento_versao where orgao_id = $1 and conteudo is not null)::int as versoes,
              (select coalesce(sum(coalesce(octet_length(conteudo), 0) + coalesce(octet_length(miniatura), 0)), 0) from foto where orgao_id = $1)::bigint
            + (select coalesce(sum(octet_length(conteudo)), 0) from documento_versao where orgao_id = $1)::bigint as bytes`, [orgaoId])).rows[0];
    r.restantes.fotos += q.fotos;
    r.restantes.versoes += q.versoes;
    r.restantes.bytes += Number(q.bytes);
  });
  return r;
}

if (process.argv[1]?.endsWith("mover-arquivos.ts")) {
  try { process.loadEnvFile(".env"); } catch {}
  const liberar = process.argv.includes("--liberar");
  const url = process.env.ARMAZENAMENTO_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("Defina ARMAZENAMENTO_DATABASE_URL (conexão de administrador do banco) ou DATABASE_URL.");
  const arm = armazenamento();
  if (!arm) throw new Error("Defina SUPABASE_URL e SUPABASE_SECRET_KEY (ou ARMAZENAMENTO_PASTA, só para teste local).");
  (async () => {
    if (arm instanceof ArmazenamentoSupabase) console.log(`Bucket "${arm.bucket}": ${await arm.prepararBucket()}.`);
    const c = new Client(opcoesDeConexao(url));
    await c.connect();
    try {
      console.log(liberar ? "Copiando, conferindo e liberando o banco..." : "Copiando e conferindo (o banco não é alterado além do caminho do arquivo)...");
      const r = await moverArquivos(c, arm, { liberar, aviso: console.log });
      console.log(`Fotos copiadas: ${r.fotosCopiadas}. Versões de documentos copiadas: ${r.versoesCopiadas}.`);
      if (liberar) console.log(`Fotos liberadas do banco: ${r.fotosLiberadas}. Versões liberadas: ${r.versoesLiberadas}.`);
      console.log(`Ainda no banco: ${r.restantes.fotos} fotos, ${r.restantes.versoes} versões (${(r.restantes.bytes / 1048576).toFixed(1)} MB).`);
      if (r.falhas.length) {
        console.log(`${r.falhas.length} arquivo(s) com falha; nada foi apagado deles. Rode de novo para tentar outra vez.`);
        process.exitCode = 1;
      } else if (liberar && r.restantes.bytes === 0) {
        console.log("Tudo no armazenamento. Para devolver o espaço ao disco: vacuum full foto, documento_versao;");
      }
    } finally {
      await c.end();
    }
  })();
}
