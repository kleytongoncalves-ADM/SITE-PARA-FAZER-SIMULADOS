"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Link2, Mail, MessageCircle, Plus, RefreshCw, Send, X } from "lucide-react";
import { Avisos } from "@/componentes/Avisos";
import { acaoConvidarPorEmail, acaoGerarLinkAberto } from "../../acoes";

type Sugestao = { razaoSocial: string; cnpj: string; email: string | null };
type Linha = { empresa: string; email: string; cnpj: string };
type Props = {
  id: string; rascunho: boolean; emailAutomatico: boolean; linkAberto: string | null; sugestoes: Sugestao[];
  orgao: string; titulo: string; prazo: string; jaConvidados: string[];
};

const VAZIA: Linha = { empresa: "", email: "", cnpj: "" };
const mascaraCnpj = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
};
function cnpjValido(v: string) {
  const d = v.replace(/\D/g, "");
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const calc = (n: number) => { const p = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]; const r = p.reduce((t, x, i) => t + x * Number(d[i]), 0) % 11; return r < 2 ? 0 : 11 - r; };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

/** Convidar fornecedores: e-mail automático (Fornecedor +) ou link para compartilhar. */
export function ConvidarFornecedores(p: Props) {
  const [aberto, setAberto] = useState<"email" | "link" | null>(null);
  return (
    <section className="cartao surgir">
      <h2 className="cartao-titulo">Convidar fornecedores</h2>
      <div className="convidar-opcoes">
        <button type="button" className={`convidar-opcao ${aberto === "email" ? "ativa" : ""}`} onClick={() => setAberto(aberto === "email" ? null : "email")} aria-expanded={aberto === "email"}>
          <span className="convidar-icone"><Mail /></span>
          <span><b>Enviar por e-mail</b><small>O sistema envia o convite. Informe empresa, e-mail e CNPJ.</small></span>
        </button>
        <button type="button" className={`convidar-opcao ${aberto === "link" ? "ativa" : ""}`} onClick={() => setAberto(aberto === "link" ? null : "link")} aria-expanded={aberto === "link"}>
          <span className="convidar-icone"><Link2 /></span>
          <span><b>Compartilhar link</b><small>Copie o link e envie por WhatsApp, e-mail ou outro meio.</small></span>
        </button>
      </div>
      {aberto === "email" && <PorEmail {...p} />}
      {aberto === "link" && <PorLink {...p} />}
      <p className="convidar-depois">O fornecedor cria o acesso da empresa, vê os itens e envia a proposta. Ela aparece aqui.</p>
    </section>
  );
}

function PorEmail({ id, rascunho, emailAutomatico, sugestoes, jaConvidados }: Props) {
  const [linhas, setLinhas] = useState<Linha[]>([{ ...VAZIA }]);
  const [errosLinha, setErrosLinha] = useState<Record<number, string>>({});
  const [estado, setEstado] = useState<{ erro?: string; ok?: string }>({});
  const [ocupado, iniciar] = useTransition();
  const ja = new Set(jaConvidados);

  const mudar = (i: number, k: keyof Linha, v: string) => {
    setLinhas((l) => l.map((x, j) => {
      if (j !== i) return x;
      const nova = { ...x, [k]: k === "cnpj" ? mascaraCnpj(v) : v };
      // Fornecedor já cadastrado: nome ou CNPJ trazem o restante.
      const s = k === "empresa" ? sugestoes.find((e) => e.razaoSocial.toLowerCase() === v.trim().toLowerCase())
        : k === "cnpj" ? sugestoes.find((e) => e.cnpj === v.replace(/\D/g, "")) : undefined;
      if (s) return { empresa: s.razaoSocial, cnpj: mascaraCnpj(s.cnpj), email: nova.email || s.email || "" };
      return nova;
    }));
    setErrosLinha((e) => { const n = { ...e }; delete n[i]; return n; });
  };

  function conferir(): Record<number, string> {
    const erros: Record<number, string> = {};
    const vistos = new Map<string, number>();
    linhas.forEach((l, i) => {
      if (!l.empresa.trim() && !l.email.trim() && !l.cnpj.trim()) return;
      const d = l.cnpj.replace(/\D/g, "");
      if (!l.empresa.trim()) erros[i] = "Informe o nome da empresa.";
      else if (!cnpjValido(d)) erros[i] = "CNPJ inválido.";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(l.email.trim())) erros[i] = "E-mail inválido.";
      else if (vistos.has(d)) erros[i] = `CNPJ repetido na linha ${vistos.get(d)! + 1}.`;
      else if (ja.has(d)) erros[i] = "Esta empresa já foi convidada.";
      vistos.set(d, i);
    });
    return erros;
  }

  function enviar() {
    setEstado({});
    const erros = conferir();
    setErrosLinha(erros);
    if (Object.keys(erros).length) return setEstado({ erro: "Corrija as linhas marcadas." });
    iniciar(async () => {
      const r = await acaoConvidarPorEmail(id, linhas);
      if (r.errosLinha) setErrosLinha(r.errosLinha);
      if (r.erro) return setEstado({ erro: r.erro });
      setLinhas([{ ...VAZIA }]);
      setEstado({ ok: r.ok });
    });
  }

  const preenchidas = linhas.filter((l) => l.empresa.trim() || l.email.trim() || l.cnpj.trim()).length;
  return (
    <div className="convidar-painel">
      <Avisos erro={estado.erro} ok={estado.ok} />
      <datalist id="forn-cadastrados">{sugestoes.map((s) => <option key={s.cnpj} value={s.razaoSocial} />)}</datalist>
      <div className="convidar-linhas" role="table" aria-label="Fornecedores a convidar">
        <div className="convidar-linha cabeca" role="row"><span role="columnheader">Empresa</span><span role="columnheader">E-mail</span><span role="columnheader">CNPJ</span><span /></div>
        {linhas.map((l, i) => (
          <div key={i} className={`convidar-linha ${errosLinha[i] ? "com-erro" : ""}`} role="row">
            <input className="entrada-texto" aria-label={`Empresa, linha ${i + 1}`} list="forn-cadastrados" value={l.empresa} onChange={(e) => mudar(i, "empresa", e.target.value)} maxLength={160} placeholder="Nome da empresa" />
            <input className="entrada-texto" aria-label={`E-mail, linha ${i + 1}`} type="email" value={l.email} onChange={(e) => mudar(i, "email", e.target.value)} maxLength={160} placeholder="compras@empresa.com.br" />
            <input className="entrada-texto num" aria-label={`CNPJ, linha ${i + 1}`} inputMode="numeric" value={l.cnpj} onChange={(e) => mudar(i, "cnpj", e.target.value)} placeholder="00.000.000/0000-00" />
            <button type="button" className="redondo-pequeno" aria-label={`Tirar a linha ${i + 1}`} onClick={() => setLinhas((x) => (x.length === 1 ? [{ ...VAZIA }] : x.filter((_, j) => j !== i)))}><X /></button>
            {errosLinha[i] && <span className="erro" role="alert">{errosLinha[i]}</span>}
          </div>
        ))}
      </div>
      <div className="convidar-rodape">
        <button type="button" className="botao botao-neutro" onClick={() => setLinhas((x) => [...x, { ...VAZIA }])} disabled={linhas.length >= 50}><Plus /> Fornecedor +</button>
        <span className="fraco">{rascunho ? "Os e-mails saem quando a solicitação for enviada." : emailAutomatico ? "Os e-mails saem na hora." : "Envio automático de e-mail não configurado: os convites ficam gravados e o link de cada um aparece na lista."}</span>
        <button type="button" className="botao botao-primario" onClick={enviar} disabled={ocupado || !preenchidas}>
          <Send /> {ocupado ? "Enviando…" : rascunho ? `Incluir ${preenchidas || ""} ${preenchidas === 1 ? "convite" : "convites"}` : `Enviar ${preenchidas || ""} ${preenchidas === 1 ? "convite" : "convites"}`}
        </button>
      </div>
    </div>
  );
}

function PorLink({ id, rascunho, linkAberto, orgao, titulo, prazo }: Props) {
  const [copiado, setCopiado] = useState<"link" | "mensagem" | null>(null);
  const [erro, setErro] = useState<string>();
  const [ocupado, iniciar] = useTransition();
  const url = () => `${window.location.origin}${linkAberto}`;
  const mensagem = () => `Prezados,\n\n${orgao} solicita cotação de materiais: ${titulo}.\n\nPara participar, acesse o link abaixo, cadastre a empresa (ou entre, se já tem acesso) e envie a proposta até ${prazo} (horário de Brasília).\n\n${url()}`;
  const copiar = async (o: "link" | "mensagem") => {
    try {
      await navigator.clipboard.writeText(o === "link" ? url() : mensagem());
      setCopiado(o);
      setTimeout(() => setCopiado(null), 1800);
    } catch { /* área de transferência bloqueada: o campo continua selecionável */ }
  };
  const gerar = (trocar: boolean) => {
    if (trocar && !window.confirm("Gerar um novo link? O link atual deixa de funcionar. Quem já entrou continua com a cotação.")) return;
    iniciar(async () => { const r = await acaoGerarLinkAberto(id, trocar); setErro(r.erro); });
  };
  if (!linkAberto) {
    return (
      <div className="convidar-painel">
        <Avisos erro={erro} />
        <p className="cartao-sub">Um link só para esta cotação, igual para todos. Quem abrir cadastra a empresa e já encontra os itens.</p>
        <div><button type="button" className="botao botao-primario" disabled={ocupado} onClick={() => gerar(false)}><Link2 /> {ocupado ? "Criando…" : "Criar link"}</button></div>
      </div>
    );
  }
  return (
    <div className="convidar-painel">
      <Avisos erro={erro} />
      <div className="cot-link">
        <input readOnly value={linkAberto} aria-label="Link compartilhado da cotação" onFocus={(e) => { e.currentTarget.value = url(); e.currentTarget.select(); }} />
        <button type="button" className="botao botao-primario botao-pequeno" onClick={() => copiar("link")}>{copiado === "link" ? <><Check /> Copiado</> : <><Copy /> Copiar link</>}</button>
      </div>
      <div className="cot-fornecedor-acoes" style={{ marginTop: 0, paddingTop: 0 }}>
        <button type="button" className="botao botao-neutro botao-pequeno" onClick={() => copiar("mensagem")}>{copiado === "mensagem" ? <><Check /> Copiada</> : <><Copy /> Copiar mensagem</>}</button>
        <button type="button" className="botao botao-neutro botao-pequeno" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(mensagem())}`, "_blank", "noopener")}><MessageCircle /> WhatsApp</button>
        <button type="button" className="botao botao-neutro botao-pequeno" onClick={() => { window.location.href = `mailto:?subject=${encodeURIComponent(`Cotação de materiais: ${titulo}`)}&body=${encodeURIComponent(mensagem())}`; }}><Mail /> E-mail</button>
        <button type="button" className="botao botao-texto botao-pequeno" disabled={ocupado} onClick={() => gerar(true)}><RefreshCw /> Novo link</button>
      </div>
      <p className="cartao-sub">{rascunho ? "O link passa a funcionar quando a solicitação for enviada. Quem entrar por ele aparece na lista, marcado \"Pelo link\"." : "Quem entrar pelo link aparece na lista, marcado \"Pelo link\"."}</p>
    </div>
  );
}
