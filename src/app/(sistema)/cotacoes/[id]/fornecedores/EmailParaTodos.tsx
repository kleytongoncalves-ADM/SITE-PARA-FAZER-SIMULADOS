"use client";

import { useState, useTransition } from "react";
import { Link2, Mail } from "lucide-react";
import { Avisos } from "@/componentes/Avisos";
import { acaoGerarLinkAberto, acaoRegistrarAberturaEmGrupo } from "../../acoes";

type Destino = { conviteId: string; razaoSocial: string; email: string };
type Props = { id: string; linkAberto: string | null; orgao: string; titulo: string; prazo: string; detalhes: string; destinos: Destino[] };

/**
 * Um e-mail só, do programa de e-mail da própria pessoa, com os fornecedores em cópia oculta (Cco):
 * nenhum vê quem mais recebeu. Vai com o link compartilhado da cotação, porque o link exclusivo
 * de cada um não cabe numa mensagem única. Quem já foi convidado e entra pelo link cai no próprio convite.
 */
export function EmailParaTodos({ id, linkAberto, orgao, titulo, prazo, detalhes, destinos }: Props) {
  const [marcados, setMarcados] = useState<Set<string>>(() => new Set(destinos.map((d) => d.conviteId)));
  const [erro, setErro] = useState<string>();
  const [ocupado, iniciar] = useTransition();
  const escolhidos = destinos.filter((d) => marcados.has(d.conviteId));
  const assunto = `Cotação de materiais: ${titulo}`;
  function alternar(c: string) {
    setMarcados((m) => { const n = new Set(m); if (n.has(c)) n.delete(c); else n.add(c); return n; });
  }
  function abrir() {
    if (!linkAberto || !escolhidos.length) return;
    const url = `${window.location.origin}${linkAberto}`;
    const corpo = `Prezados,\n\n${orgao} solicita cotação de materiais: ${titulo}.\n${detalhes}\n\nPara participar, acesse o link abaixo, cadastre a empresa (ou entre, se já tem acesso) e envie a proposta até ${prazo} (horário de Brasília).\n\n${url}`;
    void acaoRegistrarAberturaEmGrupo(escolhidos.map((d) => ({ conviteId: d.conviteId, email: d.email })), assunto);
    window.location.href = `mailto:?bcc=${escolhidos.map((d) => encodeURIComponent(d.email)).join(",")}&subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
  }
  return (
    <section className="cartao surgir">
      <h2 className="cartao-titulo">E-mail para vários fornecedores</h2>
      <p className="cartao-sub">Abre o seu e-mail com os fornecedores em cópia oculta (Cco): cada um recebe sem ver quem mais foi chamado.</p>
      <Avisos erro={erro} />
      <ul className="email-grupo">
        {destinos.map((d) => (
          <li key={d.conviteId}>
            <label className="opcao-check"><input type="checkbox" checked={marcados.has(d.conviteId)} onChange={() => alternar(d.conviteId)} /><span className="email-grupo-nome"><b>{d.razaoSocial}</b><span className="fraco">{d.email}</span></span></label>
          </li>
        ))}
      </ul>
      <div className="rodape-form">
        {linkAberto ? (
          <button type="button" className="botao botao-primario" disabled={!escolhidos.length} onClick={abrir}><Mail /> Abrir e-mail para {escolhidos.length} {escolhidos.length === 1 ? "fornecedor" : "fornecedores"}</button>
        ) : (
          <>
            <span className="fraco" style={{ marginRight: "auto" }}>A mensagem leva o link compartilhado da cotação. Crie o link para continuar.</span>
            <button type="button" className="botao botao-neutro" disabled={ocupado} onClick={() => iniciar(async () => { const r = await acaoGerarLinkAberto(id, false); setErro(r.erro); })}>
              <Link2 /> {ocupado ? "Criando…" : "Criar link compartilhado"}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
