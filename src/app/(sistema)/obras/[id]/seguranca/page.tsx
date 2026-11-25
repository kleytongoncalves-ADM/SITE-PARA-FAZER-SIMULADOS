import type { Metadata } from "next";
import Link from "next/link";
import { FileSpreadsheet, FileText, HardHat, Plus } from "lucide-react";
import { BotaoEnviar, FormAcao } from "@/componentes/FormAcao";
import { dataCurta } from "@/lib/formato";
import { pode } from "@/servicos/permissoes";
import { EPIS, painelSeguranca, ROTULO_OCORRENCIA, TIPOS_OCORRENCIA } from "@/servicos/seguranca";
import { acaoEpi, acaoOcorrencia } from "../../../qualidade/acoes";
import { ListaInspecoes, NovaNc, TabelaNcs } from "../../../qualidade/Componentes";
import { CabecalhoObra } from "../CabecalhoObra";
import { carregarObra } from "../carregar";

export const metadata: Metadata = { title: "Segurança da obra" };
const hoje = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const somar = (iso: string, d: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + d * 864e5).toISOString().slice(0, 10);

export default async function SegurancaDaObra({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ator, obra } = await carregarObra(id);
  const cab = <CabecalhoObra obra={obra} aba="seguranca" podeEditar={pode(ator, "obra.editar")} />;
  if (!pode(ator, "seguranca.ver")) return <>{cab}<div className="cartao vazio"><b>Seu perfil não acessa a segurança do trabalho</b></div></>;
  const p = await painelSeguranca(ator, id);
  const podeParalisar = pode(ator, "seguranca.encerrar") || ator.perfil === "fiscal";
  const ncs = p.qualidade.ncs.filter((n) => n.situacao === "aberta" || n.situacao === "corrigida");

  return (
    <>
      {cab}
      <div className="seguranca-topo">
        <div className="contador-seguranca">
          <span>Dias sem acidente</span>
          <b className="num">{p.diasSemAcidente ?? "—"}</b>
          <span>{p.ultimoAcidente ? `Último em ${dataCurta(p.ultimoAcidente)}` : "Desde o início da obra"}</span>
        </div>
        <div className="indicadores" style={{ margin: 0 }}>
          <div className="indicador"><span>Acidentes</span><b className="num">{p.acidentes}</b><small>{p.afastamento} dias de afastamento</small></div>
          <div className="indicador"><span>Quase acidentes</span><b className="num">{p.quaseAcidentes}</b><small>{p.riscos} {p.riscos === 1 ? "risco grave" : "riscos graves"}</small></div>
          <div className={`indicador${p.vencidas ? " indicador-destaque" : ""}`}><span>Ações corretivas abertas</span><b className="num">{p.abertas}</b><small>{p.vencidas} com prazo vencido</small></div>
          <div className="indicador"><span>Não conformidades de segurança</span><b className="num">{ncs.length}</b><small>{p.horasParalisadas.toLocaleString("pt-BR")} h de frente paralisada</small></div>
        </div>
      </div>

      <div className="barra-acoes" style={{ margin: "18px 0 12px" }}>
        <h2 className="cartao-titulo">Ocorrências</h2>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href={`/obras/${id}/seguranca/relatorio`} className="botao botao-neutro botao-pequeno"><FileText /> Relatório</Link>
          <a href={`/obras/${id}/seguranca/excel`} className="botao botao-neutro botao-pequeno"><FileSpreadsheet /> Excel</a>
        </div>
      </div>
      <div className="grade">
        {p.ocorrencias.length === 0 ? <div className="cartao vazio"><b>Nenhuma ocorrência</b></div> : (
          <div className="tabela-caixa">
            <table className="tabela tabela-compacta">
              <thead><tr><th>Nº</th><th>Tipo</th><th>Data</th><th>O que aconteceu</th><th>Ação corretiva</th><th>Prazo</th><th>Situação</th></tr></thead>
              <tbody>
                {p.ocorrencias.map((o) => (
                  <tr key={o.id} className={o.vencida ? "linha-vencida" : ""}>
                    <td><Link href={`/seguranca/ocorrencias/${o.id}`} className="forte num">{o.numero}</Link></td>
                    <td><span className={`etiqueta ${o.tipo.startsWith("acidente") ? "et-vermelha" : o.tipo === "risco_grave" ? "et-laranja" : "et-neutra"}`}>{ROTULO_OCORRENCIA[o.tipo]}</span></td>
                    <td className="num sem-quebra">{dataCurta(o.data)}{o.hora ? ` ${o.hora}` : ""}</td>
                    <td style={{ minWidth: 220 }}>{o.descricao}<div className="fraco">{[o.local, o.envolvido, o.paralisacao ? `frente parada ${o.horasParalisadas} h` : null].filter(Boolean).join(" · ")}</div></td>
                    <td style={{ minWidth: 180 }}>{o.acaoCorretiva}<div className="fraco">{o.responsavel}</div></td>
                    <td className="num sem-quebra">{dataCurta(o.prazo)}</td>
                    <td><span className={`etiqueta ${o.situacao === "encerrada" ? "et-verde" : o.vencida ? "et-vermelha" : "et-laranja"}`}>{o.situacao === "encerrada" ? "Encerrada" : o.vencida ? "Vencida" : "Aberta"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {p.podeRegistrar && (
          <details className="detalhe-acao">
            <summary>Registrar ocorrência</summary>
            <FormAcao acao={acaoOcorrencia.bind(null, id)} className="grade-form" style={{ marginTop: 10 }}>
              <div className="campo c4"><label htmlFor="os-t">Tipo</label>
                <select id="os-t" name="tipo" className="entrada-texto" defaultValue="quase_acidente">{TIPOS_OCORRENCIA.map((t) => <option key={t} value={t}>{ROTULO_OCORRENCIA[t]}</option>)}</select></div>
              <div className="campo c3"><label htmlFor="os-d">Data</label><input id="os-d" name="data" type="date" max={hoje()} defaultValue={hoje()} className="entrada-texto" required /></div>
              <div className="campo c2"><label htmlFor="os-h">Hora</label><input id="os-h" name="hora" type="time" className="entrada-texto" /></div>
              <div className="campo c3"><label htmlFor="os-l">Local</label><input id="os-l" name="local" className="entrada-texto" /></div>
              <div className="campo c12"><label htmlFor="os-ds">O que aconteceu</label><textarea id="os-ds" name="descricao" className="entrada-texto" rows={3} required /></div>
              <div className="campo c4"><label htmlFor="os-e">Trabalhador envolvido</label><input id="os-e" name="envolvido" className="entrada-texto" /></div>
              <div className="campo c4"><label htmlFor="os-em">Empresa</label><input id="os-em" name="empresa" className="entrada-texto" /></div>
              <div className="campo c2"><label htmlFor="os-af">Dias de afastamento</label><input id="os-af" name="diasAfastamento" type="number" min={0} className="entrada-texto num" /></div>
              <div className="campo c2"><label htmlFor="os-cat">CAT</label><input id="os-cat" name="cat" className="entrada-texto" placeholder="Nº" /></div>
              <div className="campo c12"><label htmlFor="os-a">Ação corretiva</label><input id="os-a" name="acaoCorretiva" className="entrada-texto" required /></div>
              <div className="campo c6"><label htmlFor="os-r">Responsável pela ação</label><input id="os-r" name="responsavel" className="entrada-texto" required /></div>
              <div className="campo c3"><label htmlFor="os-p">Prazo</label><input id="os-p" name="prazo" type="date" defaultValue={somar(hoje(), 3)} className="entrada-texto" required /></div>
              {podeParalisar && <>
                <div className="campo c3" style={{ justifyContent: "flex-end" }}><label className="opcao-check"><input type="checkbox" name="paralisacao" value="sim" /> Paralisar a frente</label></div>
                <div className="campo c3"><label htmlFor="os-hp">Horas paradas</label><input id="os-hp" name="horasParalisadas" inputMode="decimal" className="entrada-texto num" /></div>
              </>}
              <div className="c12 rodape-form"><BotaoEnviar enviando="Registrando…"><Plus /> Registrar ocorrência</BotaoEnviar></div>
            </FormAcao>
          </details>
        )}

        <div className="diario-colunas">
          <ListaInspecoes inspecoes={p.qualidade.inspecoes} obraId={id} area="seguranca" podeRegistrar={p.podeRegistrar} />
          <section className="cartao">
            <h2 className="cartao-titulo">Entrega de EPI</h2>
            {p.podeRegistrar && (
              <FormAcao acao={acaoEpi.bind(null, id)} className="grade-form form-diario" limpar>
                <div className="campo c6"><label htmlFor="ep-t">Trabalhador</label><input id="ep-t" name="trabalhador" className="entrada-texto" required /></div>
                <div className="campo c6"><label htmlFor="ep-f">Função</label><input id="ep-f" name="funcao" className="entrada-texto" /></div>
                <div className="campo c12"><span className="rotulo-campo">EPI entregue</span>
                  <div className="opcoes-epi">{EPIS.map((e) => <label key={e} className="opcao-check"><input type="checkbox" name="epi" value={e} /> {e}</label>)}</div></div>
                <div className="campo c4"><label htmlFor="ep-d">Data</label><input id="ep-d" name="data" type="date" max={hoje()} defaultValue={hoje()} className="entrada-texto" required /></div>
                <div className="campo c4"><label htmlFor="ep-ca">CA</label><input id="ep-ca" name="ca" className="entrada-texto" placeholder="Certificado de aprovação" /></div>
                <div className="campo c4"><label htmlFor="ep-e">Empresa</label><input id="ep-e" name="empresa" className="entrada-texto" /></div>
                <div className="c12 rodape-form"><BotaoEnviar className="botao botao-neutro" enviando="Registrando…"><HardHat /> Registrar entrega</BotaoEnviar></div>
              </FormAcao>
            )}
            {p.epis.length === 0 ? <p className="cartao-sub" style={{ marginTop: 10 }}>Nenhuma entrega registrada.</p> : (
              <div className="tabela-caixa" style={{ marginTop: 10 }}><table className="tabela tabela-compacta">
                <thead><tr><th>Data</th><th>Trabalhador</th><th>EPI</th><th>CA</th></tr></thead>
                <tbody>{p.epis.slice(0, 15).map((e) => <tr key={e.id}><td className="num">{dataCurta(e.data)}</td><td>{e.trabalhador}<div className="fraco">{e.funcao ?? ""}</div></td><td>{e.quantidade > 1 ? `${e.quantidade} × ` : ""}{e.epi}</td><td className="num">{e.ca ?? "—"}</td></tr>)}</tbody>
              </table></div>
            )}
          </section>
        </div>

        <h2 className="cartao-titulo" style={{ marginTop: 8 }}>Não conformidades de segurança</h2>
        <TabelaNcs ncs={ncs} />
        {pode(ator, "seguranca.registrar") && <NovaNc obraId={id} area="seguranca" itens={p.qualidade.itens} hoje={hoje()} />}
      </div>
    </>
  );
}
