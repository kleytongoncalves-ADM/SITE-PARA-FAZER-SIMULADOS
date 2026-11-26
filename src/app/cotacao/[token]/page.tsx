import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { Clock, FileText } from "lucide-react";
import { FormularioProposta } from "@/componentes/cotacao/FormularioProposta";
import { dataHoraCurta, tempoRestante } from "@/componentes/cotacao/Pecas";
import { LogoHorizontal } from "@/componentes/Logo";
import { ErroDeRegra } from "@/lib/db";
import { moeda } from "@/lib/formato";
import { paginaDoFornecedor } from "@/servicos/cotacoes";
import { acaoDeclinar, acaoEnviarProposta, acaoSalvarRascunho } from "./acoes";
import "@/estilos/cotacoes.css";

export const metadata: Metadata = { title: "Cotação de materiais", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

function Moldura({ orgao, children }: { orgao?: string; children: React.ReactNode }) {
  return (
    <main className="cot-externa">
      <div className="cot-externa-caixa entrada">
        <div className="cot-externa-topo"><LogoHorizontal largura={170} />{orgao && <span>Solicitado por <b>{orgao}</b></span>}</div>
        {children}
      </div>
    </main>
  );
}

export default async function PaginaDoFornecedor({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ corrigir?: string }> }) {
  const { token } = await params;
  const { corrigir } = await searchParams;
  const h = await headers();
  const rede = (h.get("x-nf-client-connection-ip") ?? h.get("x-forwarded-for")?.split(",")[0] ?? "").trim() || null;
  let p;
  try {
    p = await paginaDoFornecedor(token, rede);
  } catch (e) {
    if (e instanceof ErroDeRegra) return <Moldura><h1>Aguarde alguns minutos</h1><p className="cartao-sub">{e.message}</p></Moldura>;
    throw e;
  }
  if (!p || p.estado === "revogado") {
    return <Moldura><h1>Link inválido</h1><p className="cartao-sub">Este endereço não está mais ativo. Peça um novo link a quem solicitou a cotação.</p></Moldura>;
  }
  const aberta = p.estado === "aberta";
  const editando = aberta && (!p.enviada || corrigir === "1") && p.situacao !== "declinou";

  return (
    <Moldura orgao={p.orgao}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 16 }}>
        <div style={{ minWidth: 0 }}>
          <div className="sobretitulo"><span>Cotação nº {String(p.numero).padStart(3, "0")}</span><span>/</span><span>{p.obra}</span></div>
          <h1>{p.titulo}</h1>
          <p className="cartao-sub">{p.fornecedor}</p>
        </div>
        <span className="cot-prazo"><Clock size={16} /> {aberta ? `Responder até ${dataHoraCurta(p.prazo)} · ${tempoRestante(p.prazo)}` : p.estado === "cancelada" ? "Cotação cancelada" : `Encerrada em ${dataHoraCurta(p.prazo)}`}</span>
      </div>

      {(p.localEntrega || p.observacao) && (
        <dl className="dados" style={{ marginBottom: 18 }}>
          {p.localEntrega && <div><dt>Local de entrega</dt><dd>{p.localEntrega}</dd></div>}
          {p.observacao && <div style={{ gridColumn: "1 / -1" }}><dt>Observações</dt><dd style={{ whiteSpace: "pre-wrap", fontWeight: 450 }}>{p.observacao}</dd></div>}
        </dl>
      )}

      {p.situacao === "declinou" && !editando ? (
        <div className="cartao vazio"><b>Você informou que não vai participar</b>{aberta && <Link href={`/cotacao/${token}?corrigir=1`} className="botao botao-texto">Quero enviar uma proposta</Link>}</div>
      ) : editando || (aberta && p.situacao === "declinou") ? (
        <FormularioProposta modo="fornecedor" materiais={p.materiais} inicial={p.rascunho ?? p.enviada?.dados ?? null} marcas={p.marcas} validadeMinima={p.validadeMinima}
          freteIncluso={p.freteIncluso} pontua={p.pontua} cnpjFinal={p.cnpjFinal} reenvio={!!p.enviada}
          enviar={acaoEnviarProposta.bind(null, token)} salvar={acaoSalvarRascunho.bind(null, token)} declinar={p.enviada ? undefined : acaoDeclinar.bind(null, token)} destino={`/cotacao/${token}`} />
      ) : p.enviada ? (
        <div className="grade">
          <div className="cot-comprovante">
            <span className="fraco">Proposta recebida · versão {p.enviada.versao}</span>
            <b className="num">{p.enviada.protocolo}</b>
            <span>Enviada em {dataHoraCurta(p.enviada.enviadaEm)} · total {moeda(p.enviada.total)}</span>
          </div>
          <div className="barra-acoes">
            <Link href={`/cotacao/${token}/comprovante`} className="botao botao-primario"><FileText /> Comprovante</Link>
            {aberta && <Link href={`/cotacao/${token}?corrigir=1`} className="botao botao-neutro">Corrigir e reenviar</Link>}
          </div>
          <p className="cartao-sub">{aberta ? "Até o prazo você pode corrigir e reenviar. Vale a última versão enviada." : "O prazo terminou. A proposta não pode mais ser alterada."}</p>
        </div>
      ) : (
        <div className="cartao vazio"><b>{p.estado === "cancelada" ? "Esta cotação foi cancelada" : "O prazo desta cotação terminou"}</b>Nenhuma proposta foi enviada por este link.</div>
      )}
      <p className="cartao-sub" style={{ marginTop: 22 }}>Nome, cargo e telefone informados são usados só para contato sobre esta cotação.</p>
    </Moldura>
  );
}
