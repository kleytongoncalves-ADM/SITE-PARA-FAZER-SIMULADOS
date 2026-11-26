import type { Metadata } from "next";
import Link from "next/link";
import { SemAcesso } from "@/componentes/SemAcesso";
import { dataCurta, dataHora } from "@/lib/formato";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { listarAuditoria } from "@/servicos/auditoria";
import { pode } from "@/servicos/permissoes";
import {
  ROTULO_CAMPO, ROTULO_FORMA, ROTULO_PAPEL, ROTULO_PERFIL, ROTULO_SITUACAO, ROTULO_TABELA, ROTULO_TIPO,
} from "@/servicos/rotulos";

export const metadata: Metadata = { title: "Auditoria" };

const TRADUCOES: Record<string, Record<string, string>> = {
  situacao: ROTULO_SITUACAO, tipo: ROTULO_TIPO, forma_execucao: ROTULO_FORMA, perfil: ROTULO_PERFIL, papel: ROTULO_PAPEL,
  ativo: { true: "Sim", false: "Não" }, administrador: { true: "Sim", false: "Não" },
};
const SIM_NAO: Record<string, string> = { true: "Sim", false: "Não" };
const valor = (campo: string | null, v: string | null) => {
  if (v == null || v === "") return "vazio";
  const traduzido = campo ? (TRADUCOES[campo] ?? (/^(critica|ativo|administrador)$/.test(campo) ? SIM_NAO : undefined))?.[v] : undefined;
  if (traduzido) return traduzido;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return dataHora(new Date(v));
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return dataCurta(v);
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) return "registro vinculado";
  if (/^-?\d+\.\d+$/.test(v)) return v.replace(".", ",");
  return v;
};

/** Nomes legíveis das tabelas e campos registrados na auditoria. */
const TABELA: Record<string, string> = {
  ...ROTULO_TABELA, diario: "Diário de obra", diario_complemento: "Complemento do diário", atividade: "Atividade do cronograma", cronograma: "Cronograma",
  avanco: "Avanço físico", apontamento: "Apontamento de horas", apontamento_equipamento: "Apontamento de equipamento", medicao: "Medição",
  item_medido: "Item medido", glosa: "Glosa", retencao: "Retenção", nota_fiscal: "Nota fiscal", pagamento: "Pagamento",
  orcamento: "Orçamento", orcamento_item: "Item do orçamento", contrato: "Contrato", garantia: "Garantia", aditivo: "Termo aditivo",
  aditivo_item: "Item do aditivo", revisao_preco: "Apostilamento", documento: "Documento", documento_versao: "Versão de documento",
  documento_dispensa: "Dispensa de documento", documento_empresa: "Documento de empresa", habilitacao: "ASO ou treinamento",
  nao_conformidade: "Não conformidade", inspecao: "Inspeção", ensaio: "Ensaio", ocorrencia_seguranca: "Ocorrência de segurança",
  entrega_epi: "Entrega de EPI", material: "Material", requisicao: "Requisição", cotacao_compra: "Cotação", pedido: "Pedido de compra",
  recebimento: "Recebimento", movimento_estoque: "Movimento de estoque", pessoa: "Pessoa", empresa: "Empresa",
  equipamento: "Equipamento", manutencao: "Manutenção", alocacao_pessoa: "Alocação de pessoa", alocacao_equipamento: "Alocação de equipamento",
};
const CAMPO: Record<string, string> = {
  ...ROTULO_CAMPO, atestada_por: "Atestada por", atestada_em: "Atestada em", superado_em: "Substituído em", superado_por: "Substituído por",
  superado_motivo: "Motivo da substituição", relato: "Relato", condicao: "Condição de trabalho", periodos: "Períodos", corrigida_em: "Corrigida em",
  corrigida_por: "Corrigida por", correcao: "Correção", valor_supressao: "Valor de supressão", valor_acrescimo: "Valor de acréscimo",
  responsavel_tecnico: "Responsável técnico", data_assinatura: "Data de assinatura", decidida_por: "Decidida por", decidida_em: "Decidida em",
  encerrada_em: "Encerrada em", encerrada_por: "Encerrada por", encerramento: "Encerramento", critica: "Atividade crítica",
  linha_base_em: "Linha de base em", linha_base_por: "Linha de base por", clima_manha: "Clima pela manhã", clima_tarde: "Clima à tarde",
  aprovado_por: "Aprovado por", aprovado_em: "Aprovado em", aprovada_por: "Aprovada por", aprovada_em: "Aprovada em",
  unidade_periodo: "Unidade do período", valor_liquido: "Valor líquido", valor_bruto: "Valor bruto", valor_glosa: "Valor de glosas",
  valor_retencao: "Valor de retenções", valor_inicial: "Valor inicial", enviada_em: "Enviada em", visto_observacao: "Observação do visto",
  visto_por: "Visto por", visto_em: "Visto em", assinado_por: "Assinado por", assinado_em: "Assinado em", folga: "Folga",
  planilha_id: "Planilha", prazo: "Prazo", baixada_em: "Baixada em", art: "ART ou RRT",
};

export default async function Auditoria({ searchParams }: { searchParams: Promise<{ tabela?: string }> }) {
  const { tabela } = await searchParams;
  const ator = comoAtor(await exigirUsuario());
  if (!pode(ator, "auditoria.ver")) {
    return <SemAcesso modulo="a auditoria" />;
  }
  const linhas = await listarAuditoria(ator, { tabela });
  return (
    <>
      <div className="cabecalho">
        <div>
          <div className="sobretitulo">Sistema</div>
          <h1 className="titulo">Auditoria</h1>
          <p className="subtitulo">Últimos <b>{linhas.length}</b> registros.</p>
        </div>
      </div>
      <div className="chips" style={{ marginBottom: 16 }}>
        <Link href="/administracao/auditoria" className={`chip ${!tabela ? "chip-ativo" : ""}`}>Tudo</Link>
        {Object.entries(ROTULO_TABELA).map(([k, r]) => (
          <Link key={k} href={`/administracao/auditoria?tabela=${k}`} className={`chip ${tabela === k ? "chip-ativo" : ""}`}>{r}</Link>
        ))}
      </div>
      {linhas.length === 0 ? (
        <div className="cartao vazio"><b>Nenhum registro</b></div>
      ) : (
        <div className="tabela-caixa surgir">
          <table className="tabela">
            <thead><tr><th>Quando</th><th>Quem</th><th>Registro</th><th>O que mudou</th></tr></thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.id}>
                  <td className="num" style={{ whiteSpace: "nowrap" }}>{dataHora(new Date(l.quando))}</td>
                  <td>{l.autor ?? "Sistema"}</td>
                  <td><span className="forte">{TABELA[l.tabela] ?? l.tabela}</span><br /><span className="fraco">{l.registro ?? "—"}</span></td>
                  <td>
                    {l.acao === "criou" ? (
                      <span className="etiqueta et-verde">Criou o registro</span>
                    ) : (
                      <>
                        <span className="forte">{CAMPO[l.campo ?? ""] ?? l.campo}</span><br />
                        <span className="fraco">de <s>{valor(l.campo, l.valorAnterior)}</s> para <b style={{ color: "var(--texto)" }}>{valor(l.campo, l.valorNovo)}</b></span>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
