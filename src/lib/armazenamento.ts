import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";

/**
 * Armazenamento de arquivos (fotos, documentos).
 *
 * - Supabase Storage, quando SUPABASE_URL e SUPABASE_SECRET_KEY estão definidas.
 *   O bucket é privado: só o servidor, com a chave secreta, lê e grava. Quem
 *   pode ver cada arquivo continua sendo decidido pelo sistema (empresa, obra e
 *   perfil) antes de buscar o arquivo.
 * - Pasta local, quando ARMAZENAMENTO_PASTA está definida (desenvolvimento).
 * - Sem nenhuma das duas, devolve null e o sistema guarda o conteúdo no banco,
 *   como antes.
 */
export interface Armazenamento {
  readonly tipo: "supabase" | "pasta";
  guardar(caminho: string, bytes: Buffer, mime: string): Promise<void>;
  ler(caminho: string): Promise<Buffer | null>;
  remover(caminhos: string[]): Promise<void>;
}

export const BUCKET_PADRAO = "arquivos";
/** Limite por arquivo no bucket (o maior arquivo aceito hoje é de 4 MB). */
export const LIMITE_DO_BUCKET = 5 * 1024 * 1024;

export class ErroDeArmazenamento extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroDeArmazenamento";
  }
}

const CAMINHO_VALIDO = /^[0-9A-Za-z][0-9A-Za-z._-]*(\/[0-9A-Za-z][0-9A-Za-z._-]*)*$/;
function conferirCaminho(caminho: string) {
  if (!CAMINHO_VALIDO.test(caminho) || caminho.includes("..") || caminho.length > 400) throw new ErroDeArmazenamento(`Caminho inválido: ${caminho}`);
}

/** Caminho de um arquivo, sempre começando pela empresa (órgão) dona dele. */
export function caminhoDoArquivo(orgaoId: string, ...partes: string[]) {
  const c = [orgaoId, ...partes].join("/");
  conferirCaminho(c);
  return c;
}

export function extensaoDoMime(mime: string) {
  return ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" } as Record<string, string>)[mime] ?? "bin";
}

// ---------------------------------------------------------------------------
// Supabase Storage (API REST)
// ---------------------------------------------------------------------------
export class ArmazenamentoSupabase implements Armazenamento {
  readonly tipo = "supabase" as const;
  private readonly base: string;
  constructor(url: string, private readonly chave: string, readonly bucket = BUCKET_PADRAO) {
    this.base = `${url.replace(/\/+$/, "")}/storage/v1`;
  }

  private cabecalhos(extra: Record<string, string> = {}) {
    return { apikey: this.chave, Authorization: `Bearer ${this.chave}`, ...extra };
  }

  private objeto(caminho: string) {
    conferirCaminho(caminho);
    return `${this.base}/object/${encodeURIComponent(this.bucket)}/${caminho.split("/").map(encodeURIComponent).join("/")}`;
  }

  private async falha(r: Response, acao: string): Promise<never> {
    const corpo = await r.text().catch(() => "");
    throw new ErroDeArmazenamento(`Armazenamento: falha ao ${acao} (${r.status}) ${corpo.slice(0, 200)}`);
  }

  async guardar(caminho: string, bytes: Buffer, mime: string) {
    // x-upsert: repetir o envio do mesmo arquivo (nova tentativa) não falha.
    const r = await fetch(this.objeto(caminho), {
      method: "POST", headers: this.cabecalhos({ "Content-Type": mime || "application/octet-stream", "x-upsert": "true", "Cache-Control": "max-age=31536000" }),
      body: new Uint8Array(bytes),
    });
    if (!r.ok) await this.falha(r, "guardar o arquivo");
  }

  async ler(caminho: string) {
    const r = await fetch(this.objeto(caminho).replace("/object/", "/object/authenticated/"), { headers: this.cabecalhos() });
    if (r.status === 404 || r.status === 400) {
      // O Storage responde 400 com statusCode "404" quando o objeto não existe.
      const corpo = await r.text().catch(() => "");
      if (r.status === 404 || /not.?found|"404"/i.test(corpo)) return null;
      throw new ErroDeArmazenamento(`Armazenamento: falha ao ler o arquivo (${r.status}) ${corpo.slice(0, 200)}`);
    }
    if (!r.ok) await this.falha(r, "ler o arquivo");
    return Buffer.from(await r.arrayBuffer());
  }

  async remover(caminhos: string[]) {
    if (!caminhos.length) return;
    caminhos.forEach(conferirCaminho);
    const r = await fetch(`${this.base}/object/${encodeURIComponent(this.bucket)}`, {
      method: "DELETE", headers: this.cabecalhos({ "Content-Type": "application/json" }), body: JSON.stringify({ prefixes: caminhos }),
    });
    if (!r.ok) await this.falha(r, "remover o arquivo");
  }

  /** Cria o bucket privado se ainda não existir. Usado pelo script de mudança. */
  async prepararBucket() {
    const r = await fetch(`${this.base}/bucket/${encodeURIComponent(this.bucket)}`, { headers: this.cabecalhos() });
    if (r.ok) {
      const b = (await r.json()) as { public?: boolean };
      if (b.public) throw new ErroDeArmazenamento(`O bucket "${this.bucket}" está público. Ele precisa ser privado.`);
      return "existente" as const;
    }
    const criar = await fetch(`${this.base}/bucket`, {
      method: "POST", headers: this.cabecalhos({ "Content-Type": "application/json" }),
      body: JSON.stringify({ id: this.bucket, name: this.bucket, public: false, file_size_limit: LIMITE_DO_BUCKET }),
    });
    if (!criar.ok) await this.falha(criar, "criar o bucket");
    return "criado" as const;
  }
}

// ---------------------------------------------------------------------------
// Pasta local (desenvolvimento)
// ---------------------------------------------------------------------------
export class ArmazenamentoPasta implements Armazenamento {
  readonly tipo = "pasta" as const;
  private readonly raiz: string;
  constructor(pasta: string) {
    this.raiz = resolve(pasta);
  }
  private arquivo(caminho: string) {
    conferirCaminho(caminho);
    const f = resolve(join(this.raiz, ...caminho.split("/")));
    if (!f.startsWith(this.raiz + sep)) throw new ErroDeArmazenamento(`Caminho inválido: ${caminho}`);
    return f;
  }
  async guardar(caminho: string, bytes: Buffer, _mime?: string) { // eslint-disable-line @typescript-eslint/no-unused-vars
    const f = this.arquivo(caminho);
    await mkdir(dirname(f), { recursive: true });
    await writeFile(f, bytes);
  }
  async ler(caminho: string) {
    try {
      return await readFile(this.arquivo(caminho));
    } catch (e) {
      if ((e as { code?: string }).code === "ENOENT") return null;
      throw e;
    }
  }
  async remover(caminhos: string[]) {
    for (const c of caminhos) await rm(this.arquivo(c), { force: true });
  }
}

/** Armazenamento configurado no ambiente, ou null para guardar no banco. */
export function armazenamento(): Armazenamento | null {
  const url = process.env.SUPABASE_URL?.trim();
  const chave = process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket = process.env.ARMAZENAMENTO_BUCKET?.trim() || BUCKET_PADRAO;
  if (url && chave) return new ArmazenamentoSupabase(url, chave, bucket);
  if (url || chave) throw new ErroDeArmazenamento("Configure SUPABASE_URL e SUPABASE_SECRET_KEY juntas.");
  const pasta = process.env.ARMAZENAMENTO_PASTA?.trim();
  if (pasta) return new ArmazenamentoPasta(pasta);
  return null;
}

/** Armazenamento obrigatório (para ler arquivos que já estão fora do banco). */
export function armazenamentoObrigatorio(): Armazenamento {
  const a = armazenamento();
  if (!a) throw new ErroDeArmazenamento("Arquivo no armazenamento, mas SUPABASE_URL e SUPABASE_SECRET_KEY não estão configuradas.");
  return a;
}
