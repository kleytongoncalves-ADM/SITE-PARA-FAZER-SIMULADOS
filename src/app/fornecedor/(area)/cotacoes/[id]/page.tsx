import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, FileText, Landmark } from "lucide-react";
import { FormularioProposta } from "@/componentes/cotacao/FormularioProposta";
import { dataHoraCurta, tempoRestante } from "@/componentes/cotacao/Pecas";
import { exigirFornecedor } from "@/lib/sessao";
import { moeda } from "@/lib/formato";
import { cotacaoDoFornecedor, respondeCotacoes } from "@/servicos/fornecedores";
import { BotaoConversarOrgao } from "@/componentes/fornecedor/BotaoConversarOrgao";
import { acaoDeclinarNaArea, acaoEnviarNaArea, acaoSalvarNaArea } from "../../../acoes";

export const metadata: Metadata = { title: "Responder cotação · Fornecedor" };

export default async function ResponderCotacao({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ corrigir?: string }> }) {
  const { id } = await params;
  const { corrigir } = await searchParams;
  const f = await exigirFornecedor();
  const h = await headers();
  const rede = (h.get("x-nf-client-connection-ip") ?? h.get("x-forwarded-for")?.split(",")[0] ?? "").trim() || null;
  const p = await cotacaoDoFornecedor(f, id, rede);
  if (!p) notFound();
  const aberta = p.estado === "aberta";
  const responde = respondeCotacoes(f);
  const editando = responde && aberta && (!p.enviada || corrigir === "1") && (p.situacao !== "declinou" || corrigir === "1");
  const aqui = `/fornecedor/cotacoes/${id}`;
  const inicial = p.rascunho ?? p.enviada?.dados ?? { responsavelNome: f.nome, itens: {} };

  return (
    <div className="grade cot-na-area">
      <Link href="/fornecedor/cotacoes" className="botao botao-texto" style={{ justifySelf: "start" }}><ArrowLeft /> Cotações</Link>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <div className="sobretitulo"><span>Cotação nº {String(p.numero).padStart(3, "0")}</span><span>/</span><span>{p.obra}</span></div>
          <h1 className="titulo" style={{ fontSize: 28 }}>{p.titulo}</h1>
          <p className="subtitulo forn-solicitante"><Landmark /> Solicitado por <b>{p.orgao}</b></p>
        </div>
        <span style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        {responde && <BotaoConversarOrgao conviteId={id} orgao={p.orgao} />}
        <span className="cot-prazo"><Clock size={16} /> {aberta ? `Responder até ${dataHoraCurta(p.prazo)} · ${tempoRestante(p.prazo)}` : p.estado === "cancelada" ? "Cotação cancelada" : `Encerrada em ${dataHoraCurta(p.prazo)}`}</span>
        </span>
      </div>

      {(p.localEntrega || p.observacao) && (
        <dl className="dados">
          {p.localEntrega && <div><dt>Local de entrega</dt><dd>{p.localEntrega}</dd></div>}
          <div><dt>Frete</dt><dd>{p.freteIncluso ? "Incluído nos preços" : "Informado à parte"}</dd></div>
          {p.validadeMinima && <div><dt>Validade mínima</dt><dd>{p.validadeMinima} dias</dd></div>}
          {p.observacao && <div style={{ gridColumn: "1 / -1" }}><dt>Observações</dt><dd style={{ whiteSpace: "pre-wrap", fontWeight: 450 }}>{p.observacao}</dd></div>}
        </dl>
      )}

      <section className="cartao">
        {!responde && aberta && !p.enviada && p.situacao !== "declinou" ? (
          <div className="vazio"><b>Aguardando resposta da empresa</b>Seu usuário é só de consulta. Quem responde cotações na sua empresa envia a proposta.</div>
        ) : p.situacao === "declinou" && !editando ? (
          <div className="vazio"><b>Você informou que não vai participar</b>{aberta && responde && <Link href={`${aqui}?corrigir=1`} className="botao botao-texto">Quero enviar uma proposta</Link>}</div>
        ) : editando ? (
          <FormularioProposta modo="fornecedor" materiais={p.materiais} inicial={inicial} marcas={p.marcas} validadeMinima={p.validadeMinima}
            freteIncluso={p.freteIncluso} pontua={p.pontua} cnpjFinal={p.cnpjFinal} cnpjFixo={f.cnpj} reenvio={!!p.enviada}
            enviar={acaoEnviarNaArea.bind(null, id)} salvar={acaoSalvarNaArea.bind(null, id)} declinar={p.enviada ? undefined : acaoDeclinarNaArea.bind(null, id)} destino={aqui} />
        ) : p.enviada ? (
          <div className="grade">
            <div className="cot-comprovante">
              <span className="fraco">Proposta recebida · versão {p.enviada.versao}</span>
              <b className="num">{p.enviada.protocolo}</b>
              <span>Enviada em {dataHoraCurta(p.enviada.enviadaEm)} · total {moeda(p.enviada.total)}</span>
            </div>
            <div className="barra-acoes">
              <Link href={`${aqui}/comprovante`} className="botao botao-primario"><FileText /> Comprovante</Link>
              {aberta && responde && <Link href={`${aqui}?corrigir=1`} className="botao botao-neutro">Corrigir e reenviar</Link>}
            </div>
            <p className="cartao-sub">{aberta ? "Até o prazo você pode corrigir e reenviar. Vale a última versão enviada." : "O prazo terminou. A proposta não pode mais ser alterada."}</p>
          </div>
        ) : (
          <div className="vazio"><b>{p.estado === "cancelada" ? "Esta cotação foi cancelada" : "O prazo desta cotação terminou"}</b>Nenhuma proposta foi enviada.</div>
        )}
      </section>
    </div>
  );
}
