import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Ban, CheckCheck, Wrench } from "lucide-react";
import { BotaoImprimir } from "@/componentes/BotaoImprimir";
import { BotaoEnviar, FormAcao } from "@/componentes/FormAcao";
import { EnviarFoto } from "@/componentes/Fotos";
import { CabecalhoRelatorio, RodapeRelatorio, Secao } from "@/componentes/relatorio/Estrutura";
import { ErroDeRegra } from "@/lib/db";
import { dataCurta, dataHora } from "@/lib/formato";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { SemPermissao } from "@/servicos/permissoes";
import type { FotoResumo } from "@/servicos/campo";
import { obterNc, ROTULO_GRAVIDADE, ROTULO_ORIGEM_NC, ROTULO_SITUACAO_NC, rotuloNc } from "@/servicos/qualidade";
import { acaoCancelarNc, acaoCorrigirNc, acaoVerificarNc } from "../../qualidade/acoes";

export const metadata: Metadata = { title: "Não conformidade" };

function Fotos({ fotos, vazio }: { fotos: FotoResumo[]; vazio: string }) {
  if (!fotos.length) return <p className="fraco" style={{ fontSize: 13 }}>{vazio}</p>;
  return (
    <div className="rel-fotos">
      {fotos.map((f) => (
        <figure key={f.id}>
          <a href={`/fotos/${f.id}`} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/fotos/${f.id}`} alt={f.legenda ?? "Foto"} />
          </a>
          <figcaption>{f.tiradaEm ? dataHora(new Date(f.tiradaEm)) : ""}{f.legenda ? ` · ${f.legenda}` : ""}{f.latitude != null ? ` · ${f.latitude.toFixed(5)}, ${f.longitude!.toFixed(5)}` : ""}</figcaption>
        </figure>
      ))}
    </div>
  );
}

export default async function PaginaNc({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await exigirUsuario();
  let n;
  try {
    n = await obterNc(comoAtor(u), id);
  } catch (e) {
    if (e instanceof ErroDeRegra || e instanceof SemPermissao) notFound();
    throw e;
  }
  const caminho = `/nao-conformidades/${id}`;
  const ativa = n.situacao === "aberta" || n.situacao === "corrigida";
  const selo = { aberta: "vermelho", corrigida: "laranja", encerrada: "verde", cancelada: "neutro" } as const;

  return (
    <div className="grade">
      <div className="barra-acoes nao-imprimir">
        <Link href={`/obras/${n.obraId}/${n.area}`} className="botao botao-neutro"><ArrowLeft /> Voltar à obra</Link>
        <BotaoImprimir />
      </div>

      {ativa && (n.podeCorrigir || n.podeVerificar || n.podeCancelar || n.podeFotoAntes) && (
        <div className="diario-colunas nao-imprimir">
          {(n.podeFotoAntes || n.podeCorrigir) && (
            <section className="cartao">
              <h2 className="cartao-titulo">Evidências</h2>
              {n.podeFotoAntes && <div style={{ marginTop: 10 }}><EnviarFoto obraId={n.obraId} alvo={{ naoConformidadeId: id }} momento="antes" rotulo="Foto da não conformidade" caminho={caminho} /></div>}
              {(n.podeCorrigir || n.situacao === "corrigida") && <div style={{ marginTop: 10 }}><EnviarFoto obraId={n.obraId} alvo={{ naoConformidadeId: id }} momento="depois" rotulo="Foto da correção" caminho={caminho} /></div>}
            </section>
          )}
          {n.podeCorrigir && (
            <section className="cartao">
              <h2 className="cartao-titulo">Registrar correção</h2>
              <FormAcao acao={acaoCorrigirNc.bind(null, id, n.obraId)} className="grade" style={{ marginTop: 10 }}>
                <textarea name="correcao" className="entrada-texto" rows={3} required placeholder="O que foi feito para corrigir" aria-label="Correção" />
                <div className="rodape-form"><BotaoEnviar enviando="Registrando…"><Wrench /> Enviar para verificação</BotaoEnviar></div>
              </FormAcao>
            </section>
          )}
          {n.podeVerificar && (
            <section className="cartao">
              <h2 className="cartao-titulo">Verificação do fiscal</h2>
              <FormAcao acao={acaoVerificarNc.bind(null, id, n.obraId)} className="grade" style={{ marginTop: 10 }}>
                <textarea name="verificacao" className="entrada-texto" rows={2} required placeholder="Como a correção foi conferida" aria-label="Verificação" />
                <div className="form-linha">
                  <BotaoEnviar name="resultado" value="aceita" enviando="Registrando…"><CheckCheck /> Aceitar e encerrar</BotaoEnviar>
                  <BotaoEnviar name="resultado" value="recusa" className="botao botao-neutro" enviando="Registrando…">Recusar correção</BotaoEnviar>
                </div>
              </FormAcao>
            </section>
          )}
          {n.podeCancelar && (
            <section className="cartao">
              <h2 className="cartao-titulo">Cancelar</h2>
              <FormAcao acao={acaoCancelarNc.bind(null, id, n.obraId)} className="form-linha" style={{ marginTop: 10 }} confirmar="Cancelar esta não conformidade?">
                <input name="motivo" className="entrada-texto" style={{ flex: 1, minWidth: 180 }} required placeholder="Motivo" aria-label="Motivo do cancelamento" />
                <BotaoEnviar className="botao botao-neutro" enviando="Cancelando…"><Ban /> Cancelar</BotaoEnviar>
              </FormAcao>
            </section>
          )}
        </div>
      )}

      <article className="rel">
        <CabecalhoRelatorio
          orgao={u.orgaoNome}
          tipo={n.area === "seguranca" ? "Não conformidade de segurança" : "Não conformidade"}
          titulo={`${rotuloNc(n)} · ${n.titulo}`}
          subtitulo={`${n.obra.codigo} · ${n.obra.nome}`}
          selo={{ texto: ROTULO_SITUACAO_NC[n.situacao], cor: selo[n.situacao] }}
          dados={[
            ["Gravidade", `${ROTULO_GRAVIDADE[n.gravidade]}${n.impeditiva ? " · impeditiva" : ""}`],
            ["Responsável", n.responsavel],
            ["Prazo", `${dataCurta(n.prazo)}${n.vencida ? " (vencido)" : ""}`],
            ["Origem", `${ROTULO_ORIGEM_NC[n.origem]}${n.inspecaoNumero ? ` nº ${n.inspecaoNumero}` : n.ensaioNumero ? ` nº ${n.ensaioNumero}` : ""}`],
            ["Local", n.local ?? "—"],
            ["Item da planilha", n.itemNumero ? `${n.itemNumero} · ${n.itemDescricao}${n.contratoNumero ? ` (contrato ${n.contratoNumero})` : ""}` : "—"],
            ["Aberta", `${dataHora(n.criadoEm)}${n.criadoPor ? ` · ${n.criadoPor}` : ""}`],
            ["Dias em aberto", String(n.diasEmAberto)],
          ]}
        />
        {n.impeditiva && ativa && <div className="rel-alerta">O item {n.itemNumero} não pode ser medido enquanto esta não conformidade estiver em aberto.</div>}

        <Secao numero={1} titulo="Descrição">
          <div className="rel-clausulas"><p>{n.descricao}</p></div>
          {n.inspecaoId && <p className="fraco nao-imprimir"><Link href={`/inspecoes/${n.inspecaoId}`}>Ver inspeção nº {n.inspecaoNumero}</Link></p>}
        </Secao>
        <Secao numero={2} titulo="Evidência: antes">
          <Fotos fotos={n.fotosAntes} vazio="Sem fotos da não conformidade." />
        </Secao>
        <Secao numero={3} titulo="Correção e verificação">
          <ol className="tramite">
            <li><b>Aberta</b><span>{dataHora(n.criadoEm)}{n.criadoPor ? ` · ${n.criadoPor}` : ""}</span></li>
            {n.correcao && <li><b>Correção{n.corrigidaEm ? ` · ${dataHora(n.corrigidaEm)}${n.corrigidaPor ? ` · ${n.corrigidaPor}` : ""}` : ""}</b><span>{n.correcao}</span></li>}
            {n.verificacao && <li><b>{n.situacao === "encerrada" ? `Verificada e encerrada · ${dataHora(n.encerradaEm!)} · ${n.encerradaPor}` : "Última verificação"}</b><span>{n.verificacao}</span></li>}
            {n.canceladaMotivo && <li><b>Cancelada</b><span>{n.canceladaMotivo}</span></li>}
          </ol>
          <h4 className="rel-sub">Evidência: depois</h4>
          <Fotos fotos={n.fotosDepois} vazio="Sem fotos da correção." />
        </Secao>
        <footer className="rel-assinaturas">
          <div><span className="rel-linha-assinatura" /><b>{n.responsavel}</b><span>Responsável pela correção</span></div>
          <div><span className="rel-linha-assinatura" /><b>{n.encerradaPor ?? "Fiscal"}</b><span>Verificação</span></div>
        </footer>
        <RodapeRelatorio texto={`CiviObras · ${u.orgaoNome} · ${n.obra.codigo} · ${rotuloNc(n)} · gerado em ${dataHora(new Date())}`} />
      </article>
    </div>
  );
}
