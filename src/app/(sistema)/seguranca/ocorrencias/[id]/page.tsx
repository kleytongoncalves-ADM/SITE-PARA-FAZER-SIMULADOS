import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCheck } from "lucide-react";
import { BotaoImprimir } from "@/componentes/BotaoImprimir";
import { BotaoEnviar, FormAcao } from "@/componentes/FormAcao";
import { EnviarFoto } from "@/componentes/Fotos";
import { CabecalhoRelatorio, RodapeRelatorio, Secao } from "@/componentes/relatorio/Estrutura";
import { ErroDeRegra } from "@/lib/db";
import { dataCurta, dataHora, numero } from "@/lib/formato";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { SemPermissao } from "@/servicos/permissoes";
import { obterOcorrencia, ROTULO_OCORRENCIA } from "@/servicos/seguranca";
import { acaoEncerrarOcorrencia } from "../../../qualidade/acoes";

export const metadata: Metadata = { title: "Ocorrência de segurança" };

export default async function PaginaOcorrencia({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await exigirUsuario();
  let o;
  try {
    o = await obterOcorrencia(comoAtor(u), id);
  } catch (e) {
    if (e instanceof ErroDeRegra || e instanceof SemPermissao) notFound();
    throw e;
  }
  const acidente = o.tipo.startsWith("acidente");

  return (
    <div className="grade">
      <div className="barra-acoes nao-imprimir">
        <Link href={`/obras/${o.obraId}/seguranca`} className="botao botao-neutro"><ArrowLeft /> Voltar à obra</Link>
        {o.diarioId && <Link href={`/diario/${o.diarioId}`} className="botao botao-neutro">Diário do dia</Link>}
        <BotaoImprimir />
      </div>
      {(o.podeEncerrar || o.podeFoto) && (
        <div className="diario-colunas nao-imprimir">
          {o.podeFoto && <section className="cartao"><h2 className="cartao-titulo">Fotos</h2><div style={{ marginTop: 10 }}><EnviarFoto obraId={o.obraId} alvo={{ ocorrenciaSegurancaId: id }} caminho={`/seguranca/ocorrencias/${id}`} /></div></section>}
          {o.podeEncerrar && (
            <section className="cartao">
              <h2 className="cartao-titulo">Encerrar</h2>
              <FormAcao acao={acaoEncerrarOcorrencia.bind(null, id, o.obraId)} className="grade" style={{ marginTop: 10 }}>
                <textarea name="encerramento" className="entrada-texto" rows={2} required placeholder="Como a ação corretiva foi concluída e conferida" aria-label="Encerramento" />
                <div className="rodape-form"><BotaoEnviar enviando="Encerrando…"><CheckCheck /> Encerrar ocorrência</BotaoEnviar></div>
              </FormAcao>
            </section>
          )}
        </div>
      )}
      <article className="rel">
        <CabecalhoRelatorio
          orgao={u.orgaoNome}
          tipo="Ocorrência de segurança do trabalho"
          titulo={`Ocorrência nº ${o.numero} · ${ROTULO_OCORRENCIA[o.tipo]}`}
          subtitulo={`${o.obra.codigo} · ${o.obra.nome}`}
          selo={{ texto: o.situacao === "encerrada" ? "Encerrada" : o.vencida ? "Prazo vencido" : "Aberta", cor: o.situacao === "encerrada" ? "verde" : o.vencida ? "vermelho" : "laranja" }}
          dados={[
            ["Data e hora", `${dataCurta(o.data)}${o.hora ? ` às ${o.hora}` : ""}`],
            ["Local", o.local ?? "—"],
            ["Envolvido", o.envolvido ?? "—"],
            ["Empresa", o.empresa ?? "—"],
            ...(acidente ? [["Afastamento", o.diasAfastamento != null ? `${o.diasAfastamento} dias` : "Sem afastamento"], ["CAT", o.cat ?? "—"]] as [string, string][] : []),
            ["Paralisação", o.paralisacao ? `Frente paralisada por ${numero(o.horasParalisadas ?? 0, 1)} h` : "Não"],
            ["Registrada", `${dataHora(o.criadoEm)}${o.criadoPor ? ` · ${o.criadoPor}` : ""}`],
          ]}
        />
        <Secao numero={1} titulo="O que aconteceu"><div className="rel-clausulas"><p>{o.descricao}</p></div></Secao>
        <Secao numero={2} titulo="Ação corretiva">
          <ol className="tramite">
            <li><b>{o.acaoCorretiva}</b><span>Responsável: {o.responsavel} · prazo {dataCurta(o.prazo)}</span></li>
            {o.encerramento && <li><b>Encerrada · {dataHora(o.encerradaEm!)} · {o.encerradaPor}</b><span>{o.encerramento}</span></li>}
          </ol>
        </Secao>
        {o.fotos.length > 0 && (
          <Secao numero={3} titulo="Registro fotográfico">
            <div className="rel-fotos">
              {o.fotos.map((f) => (
                <figure key={f.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/fotos/${f.id}`} alt={f.legenda ?? "Foto"} />
                  <figcaption>{f.tiradaEm ? dataHora(new Date(f.tiradaEm)) : ""}{f.legenda ? ` · ${f.legenda}` : ""}</figcaption>
                </figure>
              ))}
            </div>
          </Secao>
        )}
        <footer className="rel-assinaturas">
          <div><span className="rel-linha-assinatura" /><b>{o.criadoPor ?? "Registro"}</b><span>Registro da ocorrência</span></div>
          <div><span className="rel-linha-assinatura" /><b>Técnico de segurança</b><span>Investigação</span></div>
        </footer>
        <RodapeRelatorio texto={`CiviObras · ${u.orgaoNome} · ${o.obra.codigo} · ocorrência de segurança nº ${o.numero} · gerado em ${dataHora(new Date())}`} />
      </article>
    </div>
  );
}
