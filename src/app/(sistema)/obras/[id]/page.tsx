import type { Metadata } from "next";
import { Info } from "lucide-react";
import { dataCurta, numero } from "@/lib/formato";
import { listarVinculos } from "@/servicos/obras";
import { pode } from "@/servicos/permissoes";
import { proximasSituacoes, ROTULO_PAPEL, ROTULO_PERFIL, ROTULO_SITUACAO } from "@/servicos/rotulos";
import { listarUsuarios } from "@/servicos/usuarios";
import { CabecalhoObra } from "./CabecalhoObra";
import { carregarObra } from "./carregar";
import { BotaoEncerrarVinculo, FormVinculo, PainelSituacao } from "./Paineis";

export const metadata: Metadata = { title: "Obra" };

export default async function FichaObra({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ator, obra } = await carregarObra(id);
  const podeVincular = pode(ator, "obra.vincular");
  const [vinculos, usuarios] = await Promise.all([
    listarVinculos(ator, id),
    podeVincular ? listarUsuarios(ator, { somenteAtivos: true }) : Promise.resolve([]),
  ]);
  const proximas = proximasSituacoes(obra.situacao, obra.formaExecucao);
  const podeMudar = pode(ator, "obra.mudar_situacao");
  const temFiscal = vinculos.some((v) => v.papel === "fiscal");
  const faltas: string[] = [];
  if (proximas.includes("em_execucao")) {
    if (!obra.ordemServicoNumero || !obra.ordemServicoData) faltas.push("ordem de serviço com data");
    if (!obra.artNumero) faltas.push("ART ou RRT");
    if (!temFiscal) faltas.push("fiscal vinculado");
  }
  const d = (rotulo: string, valor: React.ReactNode) => (<div><dt>{rotulo}</dt><dd>{valor || "—"}</dd></div>);

  return (
    <>
      <CabecalhoObra obra={obra} aba="resumo" podeEditar={pode(ator, "obra.editar")} />
      <div className="grade duas-colunas" style={{ gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)", alignItems: "start" }}>
        <div className="grade">
          <section className="cartao surgir" style={{ "--i": 0 } as React.CSSProperties}>
            <h2 className="cartao-titulo" style={{ marginBottom: 16 }}>Dados da obra</h2>
            <dl className="dados">
              {d("Endereço", obra.endereco)}
              {d("Área", obra.areaM2 != null ? `${numero(obra.areaM2)} m²` : null)}
              {d("Extensão", obra.extensaoM != null ? `${numero(obra.extensaoM)} m` : null)}
              {d("Coordenadas", obra.latitude != null ? `${numero(obra.latitude, 6)}, ${numero(obra.longitude, 6)}` : null)}
              {d("Início previsto", obra.dataInicioPrevista && dataCurta(obra.dataInicioPrevista))}
              {d("Término previsto", obra.dataFimPrevista && dataCurta(obra.dataFimPrevista))}
            </dl>
          </section>
          <section className="cartao surgir" style={{ "--i": 1 } as React.CSSProperties}>
            <h2 className="cartao-titulo" style={{ marginBottom: 16 }}>Processo e documentos de início</h2>
            <dl className="dados">
              {d("Processo administrativo", obra.processoAdministrativo)}
              {d("Licitação", obra.licitacao)}
              {d("Fonte de recurso", obra.fonteRecurso)}
              {d("Convênio", obra.convenio)}
              {d("ART ou RRT", obra.artNumero)}
              {d("Ordem de serviço", obra.ordemServicoNumero && `${obra.ordemServicoNumero} · ${dataCurta(obra.ordemServicoData)}`)}
            </dl>
          </section>
          <section className="cartao surgir" style={{ "--i": 2 } as React.CSSProperties}>
            <h2 className="cartao-titulo">Equipe da obra</h2>
            {vinculos.length === 0 ? (
              <p className="cartao-sub">Ninguém vinculado.</p>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {vinculos.map((v) => (
                  <div key={v.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto", gap: 10, alignItems: "center", padding: "8px 12px", borderRadius: 14, background: "var(--chip)" }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{v.nome}<br /><span className="cartao-sub">desde {dataCurta(v.inicio)}</span></span>
                    <span className="etiqueta et-azul">{ROTULO_PAPEL[v.papel]}</span>
                    {podeVincular ? <BotaoEncerrarVinculo obraId={id} vinculoId={v.id} nome={v.nome} /> : <span />}
                  </div>
                ))}
              </div>
            )}
            {podeVincular && (
              <FormVinculo obraId={id} usuarios={usuarios.map((u) => ({ id: u.id, nome: u.nome, perfil: ROTULO_PERFIL[u.perfil] }))} />
            )}
          </section>
        </div>

        <section className="cartao surgir" style={{ "--i": 3 } as React.CSSProperties}>
          <h2 className="cartao-titulo">Situação</h2>
          <p className="cartao-sub" style={{ marginBottom: 14 }}>
            Hoje: <b style={{ color: "var(--texto)" }}>{ROTULO_SITUACAO[obra.situacao]}</b>.
          </p>
          {faltas.length > 0 && (
            <div className="aviso aviso-info" style={{ marginBottom: 12 }}>
              <Info />
              <span>Para iniciar a execução, falta: {faltas.join(", ")}.</span>
            </div>
          )}
          {proximas.length === 0 ? (
            <p className="cartao-sub">Situação final.</p>
          ) : podeMudar ? (
            <PainelSituacao obraId={id} proximas={proximas} />
          ) : (
            <div className="aviso aviso-info">
              <Info />
              <span>Próximas situações possíveis: {proximas.map((s) => ROTULO_SITUACAO[s]).join(", ")}. Quem registra a mudança: direção, engenheiro responsável ou gestor de contrato.</span>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
