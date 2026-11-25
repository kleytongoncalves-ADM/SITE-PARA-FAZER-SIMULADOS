import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BotaoImprimir } from "@/componentes/BotaoImprimir";
import { CabecalhoRelatorio, Indicadores, RodapeRelatorio, Secao } from "@/componentes/relatorio/Estrutura";
import { ErroDeRegra } from "@/lib/db";
import { dataCurta, dataHora } from "@/lib/formato";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { SemPermissao } from "@/servicos/permissoes";
import { obterInspecao, ROTULO_RESPOSTA, ROTULO_SITUACAO_NC, rotuloNc } from "@/servicos/qualidade";

export const metadata: Metadata = { title: "Inspeção" };

export default async function PaginaInspecao({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await exigirUsuario();
  let x;
  try {
    x = await obterInspecao(comoAtor(u), id);
  } catch (e) {
    if (e instanceof ErroDeRegra || e instanceof SemPermissao) notFound();
    throw e;
  }
  const avaliados = x.conformes + x.naoConformes;
  const pct = avaliados ? (x.conformes / avaliados) * 100 : 100;

  return (
    <div className="grade">
      <div className="barra-acoes nao-imprimir">
        <Link href={`/obras/${x.obraId}/${x.area}`} className="botao botao-neutro"><ArrowLeft /> Voltar à obra</Link>
        <BotaoImprimir />
      </div>
      <article className="rel">
        <CabecalhoRelatorio
          orgao={u.orgaoNome}
          tipo={x.area === "seguranca" ? "Inspeção de segurança" : "Inspeção de qualidade"}
          titulo={`Inspeção nº ${x.numero} · ${x.titulo}`}
          subtitulo={`${x.obra.codigo} · ${x.obra.nome}`}
          selo={{ texto: x.naoConformes ? `${x.naoConformes} não ${x.naoConformes === 1 ? "conforme" : "conformes"}` : "Conforme", cor: x.naoConformes ? "laranja" : "verde" }}
          dados={[
            ["Data", dataCurta(x.data)],
            ["Local", x.local ?? "—"],
            ["Item da planilha", x.itemNumero ?? "—"],
            ["Inspetor", `${x.criadoPor ?? "—"} · ${dataHora(x.criadoEm)}`],
          ]}
        />
        <Secao numero={1} titulo="Resumo executivo">
          <Indicadores itens={[
            { rotulo: "Conformidade", valor: `${Math.round(pct)}%`, detalhe: "itens avaliados", destaque: true },
            { rotulo: "Conformes", valor: String(x.conformes) },
            { rotulo: "Não conformes", valor: String(x.naoConformes) },
            { rotulo: "Não se aplica", valor: String(x.respostas.length - avaliados) },
            { rotulo: "Não conformidades abertas", valor: String(x.ncsAbertas.length) },
          ]} />
        </Secao>
        <Secao numero={2} titulo="Checklist">
          <table className="rel-tabela">
            <thead><tr><th style={{ width: 36 }}>Nº</th><th>Item verificado</th><th>Resultado</th><th>Observação</th></tr></thead>
            <tbody>
              {x.respostas.map((r, i) => (
                <tr key={i}>
                  <td className="num">{i + 1}</td><td>{r.pergunta}</td>
                  <td><span className={`etiqueta ${r.resposta === "conforme" ? "et-verde" : r.resposta === "nao_conforme" ? "et-vermelha" : "et-neutra"}`}>{ROTULO_RESPOSTA[r.resposta]}</span></td>
                  <td>{r.observacao ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {x.observacao && <div className="rel-clausulas"><p><b>Observações gerais.</b> {x.observacao}</p></div>}
        </Secao>
        {x.ncsAbertas.length > 0 && (
          <Secao numero={3} titulo="Não conformidades abertas">
            <table className="rel-tabela">
              <thead><tr><th>NC</th><th>Descrição</th><th>Responsável</th><th>Prazo</th><th>Situação</th></tr></thead>
              <tbody>
                {x.ncsAbertas.map((n) => (
                  <tr key={n.id}><td className="num"><Link href={`/nao-conformidades/${n.id}`}>{rotuloNc(n)}</Link></td><td>{n.titulo}</td><td>{n.responsavel}</td><td className="num">{dataCurta(n.prazo)}</td><td>{ROTULO_SITUACAO_NC[n.situacao]}</td></tr>
                ))}
              </tbody>
            </table>
          </Secao>
        )}
        <Secao numero={x.ncsAbertas.length ? 4 : 3} titulo="Metodologia">
          <ul className="rel-metodologia">
            <li><b>Conformidade:</b> itens conformes divididos pelos itens avaliados (os marcados como &quot;não se aplica&quot; ficam fora).</li>
            <li><b>Não conformidade:</b> cada item não conforme pode abrir uma não conformidade com prazo, responsável e evidência; só o fiscal a encerra.</li>
          </ul>
        </Secao>
        <footer className="rel-assinaturas">
          <div><span className="rel-linha-assinatura" /><b>{x.criadoPor ?? "Inspetor"}</b><span>Inspeção</span></div>
          <div><span className="rel-linha-assinatura" /><b>Responsável técnico</b><span>Ciência</span></div>
        </footer>
        <RodapeRelatorio texto={`CiviObras · ${u.orgaoNome} · ${x.obra.codigo} · inspeção nº ${x.numero} · gerado em ${dataHora(new Date())}`} />
      </article>
    </div>
  );
}
