/**
 * Aviso automático por WhatsApp, pela API oficial (WhatsApp Business Platform da Meta).
 * Fica desligado até as variáveis abaixo existirem no Netlify:
 *   WHATSAPP_TOKEN       chave de acesso permanente da conta
 *   WHATSAPP_NUMERO_ID   identificador do número de envio
 *   WHATSAPP_MODELO      nome do modelo de mensagem aprovado pela Meta, com 4 campos:
 *                        {{1}} órgão, {{2}} título, {{3}} prazo, {{4}} link
 * Sem elas, o envio devolve "sem serviço" e nada mais acontece.
 */

export const whatsappConfigurado = () => !!process.env.WHATSAPP_TOKEN && !!process.env.WHATSAPP_NUMERO_ID && !!process.env.WHATSAPP_MODELO;

/** Número no formato internacional, só dígitos. Celular brasileiro sem DDI ganha o 55. */
export function numeroWhatsapp(v: string | null | undefined): string | null {
  const d = (v ?? "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) return `55${d}`;
  if (d.length >= 12 && d.length <= 15) return d;
  return null;
}

export async function avisarPorWhatsapp(numero: string, campos: { orgao: string; titulo: string; prazo: string; link: string }) {
  if (!whatsappConfigurado()) return { situacao: "sem_servico" as const };
  const para = numeroWhatsapp(numero);
  if (!para) return { situacao: "falhou" as const, erro: "Número inválido" };
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${process.env.WHATSAPP_NUMERO_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp", to: para, type: "template",
        template: {
          name: process.env.WHATSAPP_MODELO, language: { code: "pt_BR" },
          components: [{ type: "body", parameters: [campos.orgao, campos.titulo, campos.prazo, campos.link].map((text) => ({ type: "text", text: text.slice(0, 200) })) }],
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) return { situacao: "falhou" as const, erro: `Erro ${r.status}` };
    return { situacao: "enviado" as const };
  } catch {
    return { situacao: "falhou" as const, erro: "Falha de conexão" };
  }
}
