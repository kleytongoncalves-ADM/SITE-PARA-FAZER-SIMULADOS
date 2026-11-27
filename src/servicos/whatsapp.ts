/**
 * Aviso automático por WhatsApp, pela API oficial (WhatsApp Business Platform da Meta).
 * É opcional e por órgão: cada órgão informa, em Comunicações › Configuração, o
 * identificador do número corporativo, a chave de acesso e o nome do modelo de
 * mensagem aprovado pela Meta. O modelo recebe 4 campos: {{1}} órgão, {{2}} título,
 * {{3}} prazo, {{4}} link. Sem configuração, nada é enviado.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { chaveDeCredenciais } from "./cotacoes";

export type CredenciaisWhatsapp = { numeroId: string; token: string; modelo: string };
export type ResultadoWhatsapp = { situacao: "enviado" } | { situacao: "falhou"; erro: string } | { situacao: "sem_servico" };

/** Número no formato internacional, só dígitos. Celular brasileiro sem DDI ganha o 55. */
export function numeroWhatsapp(v: string | null | undefined): string | null {
  const d = (v ?? "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) return `55${d}`;
  if (d.length >= 12 && d.length <= 15) return d;
  return null;
}

/** A chave de acesso fica cifrada no banco (AES-256-GCM). */
export function cifrar(texto: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", chaveDeCredenciais(), iv);
  const dados = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), dados].map((b) => b.toString("base64url")).join(".");
}

export function decifrar(guardado: string | null): string | null {
  if (!guardado) return null;
  try {
    const [iv, tag, dados] = guardado.split(".").map((p) => Buffer.from(p, "base64url"));
    const d = createDecipheriv("aes-256-gcm", chaveDeCredenciais(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(dados), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export async function enviarWhatsapp(cred: CredenciaisWhatsapp | null, numero: string, campos: { orgao: string; titulo: string; prazo: string; link: string }): Promise<ResultadoWhatsapp> {
  if (!cred) return { situacao: "sem_servico" };
  const para = numeroWhatsapp(numero);
  if (!para) return { situacao: "falhou", erro: "Número inválido" };
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(cred.numeroId)}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cred.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp", to: para, type: "template",
        template: {
          name: cred.modelo, language: { code: "pt_BR" },
          components: [{ type: "body", parameters: [campos.orgao, campos.titulo, campos.prazo, campos.link].map((text) => ({ type: "text", text: text.slice(0, 200) })) }],
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) {
      const corpo = (await r.json().catch(() => ({}))) as { error?: { message?: string } };
      return { situacao: "falhou", erro: (corpo.error?.message ?? `Erro ${r.status}`).slice(0, 300) };
    }
    return { situacao: "enviado" };
  } catch {
    return { situacao: "falhou", erro: "Falha de conexão" };
  }
}
