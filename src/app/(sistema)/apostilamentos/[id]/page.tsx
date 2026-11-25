import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BotaoImprimir } from "@/componentes/BotaoImprimir";
import { CabecalhoRelatorio, Indicadores, RodapeRelatorio, Secao } from "@/componentes/relatorio/Estrutura";
import { ErroDeRegra } from "@/lib/db";
import { dataCurta, dataHora, moeda, percentual } from "@/lib/formato";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { obterRevisao, ROTULO_REVISAO } from "@/servicos/aditivos";
import { formatarCnpj, rotuloContrato } from "@/servicos/contratos";

export const metadata: Metadata = { title: "Termo de apostilamento" };

const indice = (v: string | null) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 6 }));

export default async function TermoApostilamento({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await exigirUsuario();
  let r;
  try {
    r = await obterRevisao(comoAtor(usuario), id);
  } catch (e) {
    if (e instanceof ErroDeRegra) notFound();
    throw e;
  }
  const k = r.contrato;
  const rotuloK = rotuloContrato(k);
  const reajuste = r.tipo === "reajuste";
  const acumulado = (Number(r.fatorAcumulado) - 1) * 100;

  return (
    <div className="grade">
      <div className="barra-acoes nao-imprimir">
        <Link href={`/contratos/${k.id}#aditivos`} className="botao botao-neutro"><ArrowLeft /> Voltar ao contrato</Link>
        <BotaoImprimir />
      </div>

      <article className="rel">
        <CabecalhoRelatorio
          orgao={usuario.orgaoNome}
          tipo="Termo de apostilamento"
          titulo={`${r.numero}º apostilamento · ${rotuloK}`}
          subtitulo={`${k.obraCodigo} · ${k.obraNome}`}
          selo={{ texto: ROTULO_REVISAO[r.tipo], cor: "verde" }}
          dados={[
            ["Contratante", usuario.orgaoNome],
            ["Contratada", k.empresaNome ? `${k.empresaNome} · CNPJ ${formatarCnpj(k.empresaCnpj!)}` : "Equipe própria"],
            ["Contrato", `${rotuloK}${k.processo ? ` · processo ${k.processo}` : ""}`],
            ["Objeto", k.objeto],
            ["Data-base do orçamento", dataCurta(k.dataBase)],
            ["Registrado", `${dataHora(r.criadoEm)}${r.criadoPorNome ? ` · ${r.criadoPorNome}` : ""}`],
          ]}
        />

        <Secao numero={1} titulo="Resumo executivo">
          <Indicadores itens={[
            { rotulo: reajuste ? "Percentual de reajuste" : "Percentual de reequilíbrio", valor: percentual(r.percentual, 4), destaque: true },
            { rotulo: "Novos preços a partir de", valor: dataCurta(r.inicio) },
            { rotulo: "Revisão acumulada", valor: percentual(acumulado, 4), detalhe: "todas as revisões até esta" },
            { rotulo: "Saldo do contrato no registro", valor: moeda(r.valorSaldo), detalhe: "a preços do contrato" },
            { rotulo: "Impacto estimado no saldo", valor: moeda(r.valorImpacto) },
          ]} />
        </Secao>

        <Secao numero={2} titulo={reajuste ? "Cálculo do reajuste" : "Fundamentação do reequilíbrio"}>
          {reajuste ? (
            <table className="rel-tabela">
              <tbody>
                <tr><td>Índice</td><td className="dir">{r.indice}</td></tr>
                <tr><td>Número-índice da data-base (I₀)</td><td className="dir num">{indice(r.indiceBase)}</td></tr>
                <tr><td>Número-índice atual (I₁)</td><td className="dir num">{indice(r.indiceAtual)}</td></tr>
                <tr className="rel-linha-etapa"><td>Percentual = (I₁ ÷ I₀ − 1) × 100</td><td className="dir num">{percentual(r.percentual, 4)}</td></tr>
              </tbody>
            </table>
          ) : (
            <div className="rel-clausulas">
              <p><b>Processo ou parecer.</b> {r.documento}</p>
              <p><b>Justificativa.</b> {r.justificativa}</p>
            </div>
          )}
        </Secao>

        <Secao numero={3} titulo="Termo">
          <div className="rel-clausulas">
            <p>
              Fica registrado por apostilamento, nos termos do art. 136 da Lei 14.133/2021, {reajuste
                ? `o reajuste de ${percentual(r.percentual, 4)} dos preços do ${rotuloK.toLowerCase()}, pelo ${r.indice}, conforme a cláusula de reajuste do contrato`
                : `o reequilíbrio econômico-financeiro de ${percentual(r.percentual, 4)} sobre os preços do ${rotuloK.toLowerCase()}, conforme o art. 124, II, d, da mesma lei`},
              aplicável às medições cujo período começa em {dataCurta(r.inicio)} ou depois.
            </p>
            <p>O percentual incide sobre o valor medido a preços do contrato e entra na nota fiscal e no valor a pagar de cada medição. Ficam mantidas as demais cláusulas do contrato.</p>
          </div>
        </Secao>

        <Secao numero={4} titulo="Metodologia e fontes">
          <ul className="rel-metodologia">
            <li><b>Revisão acumulada:</b> produto de (1 + percentual) de todas as revisões com início até {dataCurta(r.inicio)}.</li>
            <li><b>Impacto estimado:</b> saldo do contrato no registro × revisão acumulada anterior × percentual desta revisão. O valor efetivo depende das medições futuras.</li>
            {reajuste && <li><b>Interregno:</b> o reajuste vale após 12 meses da data-base do orçamento ou do reajuste anterior (Lei 14.133/2021, art. 25, § 7º).</li>}
          </ul>
        </Secao>

        <footer className="rel-assinaturas">
          <div>
            <span className="rel-linha-assinatura" />
            <b>{k.gestorNome ?? "Gestor do contrato"}</b>
            <span>Gestor do contrato · {usuario.orgaoNome}</span>
          </div>
          <div>
            <span className="rel-linha-assinatura" />
            <b>Autoridade competente</b>
            <span>Ratificação</span>
          </div>
        </footer>
        <RodapeRelatorio texto={`CiviObras · ${usuario.orgaoNome} · ${rotuloK} · ${r.numero}º apostilamento · gerado em ${dataHora(new Date())}`} />
      </article>
    </div>
  );
}
