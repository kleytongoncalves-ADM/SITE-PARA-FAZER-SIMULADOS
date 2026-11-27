/**
 * Envio de e-mail pelo Resend. A chave fica na variável RESEND_API_KEY e o
 * remetente em EMAIL_REMETENTE ("CiviObras <cotacao@seudominio.com.br>"). Sem a
 * chave nada trava: o envio devolve "sem serviço" e a tela mostra o link para copiar.
 */

export type ResultadoEmail = { situacao: "enviado"; id: string | null } | { situacao: "falhou"; erro: string } | { situacao: "sem_servico" };

export const emailConfigurado = () => !!process.env.RESEND_API_KEY && !!process.env.EMAIL_REMETENTE;

/** Endereço público do sistema, para os links dos e-mails. No Netlify, URL vem pronta. */
export function enderecoDoSistema() {
  return (process.env.SITE_URL || process.env.URL || "http://localhost:3000").replace(/\/+$/, "");
}

/** Quem envia: o órgão aparece no nome do remetente, e a resposta vai para o e-mail corporativo dele. */
export type Remetente = { nome: string; responderPara: string | null };

function remetente(nome?: string | null) {
  const base = process.env.EMAIL_REMETENTE ?? "";
  if (!nome) return base;
  const endereco = base.match(/<([^>]+)>/)?.[1] ?? base.trim();
  return `${nome.replace(/["<>]/g, "").slice(0, 80)} via CiviObras <${endereco}>`;
}

export async function enviarEmail(m: { para: string; assunto: string; html: string; texto: string; responderPara?: string | null; nomeRemetente?: string | null }): Promise<ResultadoEmail> {
  if (!emailConfigurado()) return { situacao: "sem_servico" };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: remetente(m.nomeRemetente), to: [m.para], subject: m.assunto, html: m.html, text: m.texto,
        ...(m.responderPara ? { reply_to: m.responderPara } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const corpo = (await r.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!r.ok) return { situacao: "falhou", erro: (corpo.message ?? `Erro ${r.status}`).slice(0, 300) };
    return { situacao: "enviado", id: corpo.id ?? null };
  } catch (e) {
    return { situacao: "falhou", erro: (e instanceof Error ? e.message : "Falha de conexão").slice(0, 300) };
  }
}

// ---------------------------------------------------------------------------
// Modelos no padrão visual CiviObras
// ---------------------------------------------------------------------------
const PETROLEO = "#0e3a47";
const LARANJA = "#f28c28";
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Moldura comum: faixa com o logo, conteúdo em cartão branco e rodapé. Tabelas e estilos em linha, para funcionar em qualquer leitor de e-mail. */
function moldura(previa: string, corpo: string, rodape = "Mensagem automática do CiviObras, sistema de gestão de obras civis.<br>Para responder, use o botão Responder do seu e-mail.") {
  const base = enderecoDoSistema();
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CiviObras</title></head>
<body style="margin:0;padding:0;background:#eef3f4;font-family:Segoe UI,Arial,Helvetica,sans-serif;color:#17323a">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(previa)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef3f4;padding:28px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 12px 32px -18px rgba(6,40,50,.45)">
<tr><td style="background:${PETROLEO};background-image:linear-gradient(135deg,#0e3a47,#06222b);padding:22px 28px">
<img src="${base}/marca/logo.png" width="170" alt="CiviObras" style="display:block;border:0;width:170px;height:auto">
</td></tr>
<tr><td style="height:4px;background:${LARANJA};background-image:linear-gradient(90deg,#ffa850,#e06f0c)"></td></tr>
<tr><td style="padding:28px 28px 8px;font-size:15px;line-height:1.55">${corpo}</td></tr>
<tr><td style="padding:18px 28px 26px;font-size:12px;line-height:1.5;color:#5d7378;border-top:1px solid #e3eaec">
${rodape}
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function botao(rotulo: string, link: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 8px"><tr><td style="border-radius:999px;background:${LARANJA};background-image:linear-gradient(135deg,#ffa850,#e06f0c)">
<a href="${esc(link)}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px">${esc(rotulo)}</a>
</td></tr></table>`;
}

function quadro(linhas: [string, string][]) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;background:#f4f8f9;border:1px solid #dfe8ea;border-radius:14px">
${linhas.map(([k, v]) => `<tr><td style="padding:10px 16px;font-size:12.5px;color:#5d7378;width:38%;vertical-align:top">${esc(k)}</td><td style="padding:10px 16px;font-size:14px;font-weight:600;color:#17323a">${esc(v)}</td></tr>`).join("")}
</table>`;
}

export type DadosConviteEmail = {
  orgao: string; fornecedor: string; numero: number; titulo: string; obra: string; itens: number; prazo: string; link: string; temConta: boolean;
};

export function emailDeConvite(d: DadosConviteEmail) {
  const assunto = `Cotação de materiais: ${d.titulo} · ${d.orgao}`;
  const passos = d.temConta
    ? ["Entre com o e-mail e a senha da sua empresa.", "Confira os itens e as quantidades.", "Informe o preço e a marca de cada item e envie a proposta."]
    : ["Cadastre a empresa: CNPJ, dados de contato, e-mail e senha.", "Confira os itens e as quantidades.", "Informe o preço e a marca de cada item e envie a proposta."];
  const corpo = `
<p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${LARANJA}">Solicitação de cotação</p>
<h1 style="margin:0 0 14px;font-size:22px;line-height:1.25;color:${PETROLEO}">${esc(d.orgao)} pede o seu orçamento</h1>
<p style="margin:0">Prezados da <b>${esc(d.fornecedor)}</b>,</p>
<p style="margin:10px 0 0">Há uma solicitação de cotação aguardando a resposta da sua empresa.</p>
${quadro([["Solicitado por", d.orgao], ["Cotação", `Nº ${String(d.numero).padStart(3, "0")} · ${d.titulo}`], ["Obra", d.obra], ["Itens", `${d.itens} ${d.itens === 1 ? "item" : "itens"}`], ["Responder até", `${d.prazo} (horário de Brasília)`]])}
${botao("Ver cotação e responder", d.link)}
<p style="margin:22px 0 8px;font-weight:700;color:${PETROLEO}">Como responder</p>
<table role="presentation" cellpadding="0" cellspacing="0">${passos.map((p, i) => `<tr><td style="vertical-align:top;padding:4px 10px 4px 0"><span style="display:inline-block;width:24px;height:24px;line-height:24px;text-align:center;border-radius:50%;background:#e6f1f3;color:${PETROLEO};font-size:12px;font-weight:700">${i + 1}</span></td><td style="padding:6px 0;font-size:14px">${esc(p)}</td></tr>`).join("")}</table>
<p style="margin:16px 0 0;font-size:13.5px">Até o prazo, a proposta pode ser salva e continuada depois, e corrigida e reenviada. Vale a última versão enviada.</p>
<p style="margin:16px 0 0;font-size:12.5px;color:#5d7378">Este link é exclusivo da ${esc(d.fornecedor)}. Não o repasse a outras empresas.<br>Se o botão não abrir, copie o endereço: <span style="word-break:break-all">${esc(d.link)}</span></p>`;
  const texto = [
    `${d.orgao} pede o seu orçamento.`, "",
    `Cotação nº ${String(d.numero).padStart(3, "0")}: ${d.titulo}`, `Obra: ${d.obra}`, `Itens: ${d.itens}`, `Responder até: ${d.prazo} (horário de Brasília)`, "",
    "Como responder:", ...passos.map((p, i) => `${i + 1}. ${p}`), "",
    `Acesse: ${d.link}`, "", `Este link é exclusivo da ${d.fornecedor}. Não o repasse a outras empresas.`,
  ].join("\n");
  return { assunto, html: moldura(`${d.orgao} solicita cotação até ${d.prazo}`, corpo), texto };
}

export function emailDeLembrete(d: DadosConviteEmail) {
  const assunto = `Lembrete: a cotação ${d.titulo} termina em ${d.prazo}`;
  const corpo = `
<p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${LARANJA}">Lembrete de prazo</p>
<h1 style="margin:0 0 14px;font-size:22px;line-height:1.25;color:${PETROLEO}">A cotação termina amanhã</h1>
<p style="margin:0">A ${esc(d.orgao)} ainda não recebeu a proposta da <b>${esc(d.fornecedor)}</b>.</p>
${quadro([["Cotação", `Nº ${String(d.numero).padStart(3, "0")} · ${d.titulo}`], ["Itens", String(d.itens)], ["Responder até", `${d.prazo} (horário de Brasília)`]])}
${botao("Responder agora", d.link)}`;
  const texto = `A ${d.orgao} ainda não recebeu a proposta da ${d.fornecedor}.\n\nCotação nº ${String(d.numero).padStart(3, "0")}: ${d.titulo}\nResponder até: ${d.prazo}\n\n${d.link}`;
  return { assunto, html: moldura(`Responder até ${d.prazo}`, corpo), texto };
}

export function emailDePropostaRecebida(d: { fornecedor: string; numero: number; titulo: string; versao: number; link: string }) {
  const assunto = `Proposta recebida: ${d.fornecedor} · cotação nº ${String(d.numero).padStart(3, "0")}`;
  const corpo = `
<p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${LARANJA}">Cotação de materiais</p>
<h1 style="margin:0 0 14px;font-size:22px;line-height:1.25;color:${PETROLEO}">Nova proposta recebida</h1>
${quadro([["Fornecedor", d.fornecedor], ["Cotação", `Nº ${String(d.numero).padStart(3, "0")} · ${d.titulo}`], ["Versão", String(d.versao)]])}
${botao("Abrir a cotação", d.link)}`;
  const texto = `${d.fornecedor} enviou a proposta (versão ${d.versao}) da cotação nº ${String(d.numero).padStart(3, "0")}: ${d.titulo}.\n\n${d.link}`;
  return { assunto, html: moldura(`${d.fornecedor} enviou a proposta`, corpo), texto };
}

// ---------------------------------------------------------------------------
// Validação do e-mail corporativo e recuperação de senha
// ---------------------------------------------------------------------------
export function emailDeCodigo(d: { orgao: string; codigo: string }) {
  const assunto = `Código de validação: ${d.codigo}`;
  const corpo = `
<p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${LARANJA}">Validação de e-mail</p>
<h1 style="margin:0 0 14px;font-size:21px;line-height:1.3;color:#0e3a47">Confirme o e-mail corporativo de ${esc(d.orgao)}</h1>
<p style="margin:0 0 10px">Digite este código no CiviObras, em Comunicações › Configuração:</p>
<p style="margin:18px 0;font-size:32px;font-weight:800;letter-spacing:.3em;color:#0e3a47">${esc(d.codigo)}</p>
<p style="margin:0;color:#5d7378;font-size:13px">O código vale por 30 minutos. Se você não pediu esta validação, ignore esta mensagem.</p>`;
  return { assunto, html: moldura(assunto, corpo, "Mensagem automática do CiviObras."), texto: `Código de validação do e-mail corporativo de ${d.orgao}: ${d.codigo}. Vale por 30 minutos.` };
}

export function emailDeRedefinicao(d: { nome: string; link: string }) {
  const assunto = "Redefinir a senha do CiviObras";
  const corpo = `
<p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${LARANJA}">Área do fornecedor</p>
<h1 style="margin:0 0 14px;font-size:21px;line-height:1.3;color:#0e3a47">Redefinir senha</h1>
<p style="margin:0 0 10px">Olá, ${esc(d.nome)}. Recebemos um pedido para redefinir a senha do seu acesso.</p>
${botao("Criar nova senha", d.link)}
<p style="margin:14px 0 0;color:#5d7378;font-size:13px">O link vale por 1 hora e funciona uma vez. Se você não pediu, ignore esta mensagem: a senha atual continua valendo.</p>`;
  return { assunto, html: moldura(assunto, corpo, "Mensagem automática do CiviObras."), texto: `Para criar uma nova senha, acesse: ${d.link} (vale por 1 hora).` };
}

