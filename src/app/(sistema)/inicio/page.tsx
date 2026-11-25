import type { Metadata } from "next";
import Link from "next/link";
import { Building2, CircleDot, History, ListChecks, Plus, UserPlus, Users } from "lucide-react";
import { Contador } from "@/componentes/Contador";
import { EtiquetaSituacao } from "@/componentes/Situacao";
import { dataCurta, dataExtenso, haQuantoTempo, horaLocal } from "@/lib/formato";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { contarPorSituacao, eventosRecentes, listarObras } from "@/servicos/obras";
import { pode } from "@/servicos/permissoes";
import { ROTULO_PERFIL, ROTULO_TIPO, SITUACOES, type Situacao } from "@/servicos/rotulos";

export const metadata: Metadata = { title: "Início" };

const CURTO: Record<Situacao, string> = {
  em_estudo: "Em estudo", orcada: "Orçada", licitada: "Licitada", contratada: "Contratada", em_execucao: "Em execução",
  paralisada: "Paralisada", concluida: "Concluída", recebida_provisoriamente: "Receb. provisório",
  recebida_definitivamente: "Receb. definitivo", cancelada: "Cancelada",
};

const FOCO: Record<string, string> = {
  direcao: "Visão de todas as obras do órgão.",
  gestor_contrato: "Obras sob a sua gestão de contrato.",
  engenheiro: "Obras sob a sua responsabilidade técnica.",
  fiscal: "Obras que você fiscaliza.",
  administrativo: "Cadastros e pendências administrativas.",
  financeiro: "Obras vinculadas ao seu acompanhamento financeiro.",
  campo: "Obras em que você atua no canteiro.",
  contratada: "Obras dos seus contratos.",
};

export default async function Inicio() {
  const u = await exigirUsuario();
  const ator = comoAtor(u);
  const [obras, contagem, eventos] = await Promise.all([listarObras(ator), contarPorSituacao(ator), eventosRecentes(ator, 7)]);
  const agora = new Date();
  const h = horaLocal(agora);
  const saudacao = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  const emExecucao = contagem.em_execucao ?? 0;
  const paralisadas = contagem.paralisada ?? 0;
  const maior = Math.max(1, ...SITUACOES.map((s) => contagem[s] ?? 0));
  const todas = pode(ator, "obra.ver_todas");

  const atalhos = [
    pode(ator, "obra.criar") && { href: "/obras/nova", icone: Plus, titulo: "Cadastrar obra", sub: "Começa em estudo" },
    { href: "/obras", icone: Building2, titulo: todas ? "Todas as obras" : "Minhas obras", sub: `${obras.length} no seu acesso` },
    { href: "/obras?situacao=em_execucao", icone: CircleDot, titulo: "Em execução", sub: `${emExecucao} ${emExecucao === 1 ? "obra" : "obras"}` },
    pode(ator, "usuario.gerenciar") && { href: "/administracao/usuarios", icone: UserPlus, titulo: "Usuários", sub: "Acessos e perfis" },
    pode(ator, "auditoria.ver") && { href: "/administracao/auditoria", icone: History, titulo: "Auditoria", sub: "Quem alterou o quê" },
  ].filter(Boolean) as { href: string; icone: typeof Plus; titulo: string; sub: string }[];

  return (
    <>
      <div className="cabecalho">
        <div>
          <div className="sobretitulo">
            <span>{dataExtenso(agora)}</span>
            <span className="etiqueta et-azul">{ROTULO_PERFIL[u.perfil]}</span>
          </div>
          <h1 className="titulo">
            {saudacao}, <em>{u.nome.split(" ")[0]}</em>
          </h1>
          <p className="subtitulo">
            {FOCO[u.perfil]} <b>{emExecucao}</b> em execução{paralisadas > 0 && <> e <b>{paralisadas}</b> paralisada{paralisadas > 1 ? "s" : ""}</>}.
          </p>
        </div>
      </div>

      <div className="atalhos">
        {atalhos.map((a, i) => (
          <Link key={a.href} href={a.href} className="atalho surgir" style={{ "--i": i } as React.CSSProperties}>
            <span className="atalho-icone"><a.icone /></span>
            <span className="atalho-texto"><b>{a.titulo}</b><span>{a.sub}</span></span>
          </Link>
        ))}
      </div>

      <div className="grade duas-colunas" style={{ gridTemplateColumns: "minmax(0, 1.7fr) minmax(0, 1fr)", alignItems: "start" }}>
        <section className="cartao surgir" style={{ "--i": 2 } as React.CSSProperties}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
            <div>
              <p className="cartao-sub" style={{ display: "flex", alignItems: "center", gap: 7 }}><ListChecks size={14} /> Obras por situação</p>
              <div className="numero-grande" style={{ marginTop: 8 }}><Contador valor={obras.length} /></div>
              <p className="cartao-sub">{todas ? "obras no órgão" : "obras vinculadas a você"}</p>
            </div>
            <div className="chips">
              <span className="chip"><small>EM EXECUÇÃO</small> <span className="num">{emExecucao}</span></span>
              <span className="chip"><small>CONCLUÍDAS</small> <span className="num">{(contagem.concluida ?? 0) + (contagem.recebida_provisoriamente ?? 0) + (contagem.recebida_definitivamente ?? 0)}</span></span>
            </div>
          </div>
          <div className="barras-rolagem"><div className="barras" role="img" aria-label="Gráfico de obras por situação">
            {SITUACOES.map((s, i) => {
              const n = contagem[s] ?? 0;
              return (
                <Link key={s} href={`/obras?situacao=${s}`} className="barra-col" title={`${CURTO[s]}: ${n}`}>
                  <span className="barra-num num">{n}</span>
                  <span className="barra-trilho">
                    <span className={`barra-valor ${s === "em_execucao" ? "quente" : ""}`} style={{ height: `${n === 0 ? 3 : Math.max(10, (n / maior) * 100)}%`, opacity: n === 0 ? 0.35 : 1, "--i": i } as React.CSSProperties} />
                  </span>
                  <span className="barra-rotulo">{CURTO[s]}</span>
                </Link>
              );
            })}
          </div></div>
        </section>

        <section className="cartao-escuro surgir" style={{ "--i": 3 } as React.CSSProperties}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span className="etiqueta pulso" style={{ color: "#63d79a", background: "rgba(99,215,154,0.12)" }}>Atividade recente</span>
            <Users size={16} style={{ opacity: 0.5 }} />
          </div>
          {eventos.length === 0 ? (
            <p style={{ fontSize: 13.5, color: "rgba(232,243,245,0.6)", margin: "14px 4px" }}>
              Nada por aqui ainda. O que acontecer nas suas obras aparece nesta lista.
            </p>
          ) : (
            <div style={{ margin: "0 -8px" }}>
              {eventos.map((e) => (
                <Link key={e.id} href={`/obras/${e.obraId}/linha-do-tempo`} className="atividade">
                  <span className="atividade-icone"><History /></span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.obraNome}</span>
                    <span style={{ display: "block", fontSize: 12.5, color: "rgba(232,243,245,0.62)" }}>{e.resumo}</span>
                    <span style={{ display: "block", fontSize: 11.5, color: "rgba(232,243,245,0.4)", marginTop: 2 }}>
                      {haQuantoTempo(new Date(e.quando), agora)}{e.autor ? ` · ${e.autor}` : ""}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="surgir" style={{ marginTop: 18, "--i": 4 } as React.CSSProperties}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0 4px 10px" }}>
          <h2 className="cartao-titulo">{todas ? "Obras mais recentes" : "Minhas obras"}</h2>
          <Link href="/obras" className="botao botao-texto">Ver todas</Link>
        </div>
        {obras.length === 0 ? (
          <div className="cartao vazio">
            <b>Nenhuma obra no seu acesso</b>
            {pode(ator, "obra.criar") ? "Cadastre a primeira obra para começar." : "Peça ao responsável para vincular você a uma obra."}
          </div>
        ) : (
          <div className="tabela-caixa">
            <table className="tabela">
              <thead><tr><th>Obra</th><th>Tipo</th><th>Local</th><th>Término previsto</th><th>Situação</th></tr></thead>
              <tbody>
                {obras.slice(0, 5).map((o) => (
                  <tr key={o.id}>
                    <td><Link href={`/obras/${o.id}`}><span className="forte">{o.nome}</span><br /><span className="fraco num">{o.codigo}</span></Link></td>
                    <td>{ROTULO_TIPO[o.tipo]}</td>
                    <td>{[o.municipio, o.uf].filter(Boolean).join(" / ") || "—"}</td>
                    <td className="num">{dataCurta(o.dataFimPrevista)}</td>
                    <td><EtiquetaSituacao situacao={o.situacao} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
