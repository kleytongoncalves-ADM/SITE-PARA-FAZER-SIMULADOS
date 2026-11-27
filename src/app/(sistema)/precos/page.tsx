import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { dataHora, mesAno, moeda, unidadeMedida } from "@/lib/formato";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { pode } from "@/servicos/permissoes";
import {
  avisoDaBase, buscarComposicoes, buscarInsumos, listarComposicoesProprias, listarTabelas, ROTULO_FONTE, ROTULO_REGIME, ROTULO_TIPO_INSUMO,
  type TabelaPreco, type TipoInsumo,
} from "@/servicos/precos";

export const metadata: Metadata = { title: "Base de preços" };

type Busca = { ver?: string; tabela?: string; busca?: string; tipo?: string };
const ROTULO_CARGA = { liberada: ["Liberada", "et-verde"], em_conferencia: ["Em conferência", "et-laranja"], recusada: ["Recusada", "et-vermelha"] } as const;
const rotuloTabela = (t: TabelaPreco) => `${ROTULO_FONTE[t.fonte]} ${t.uf} ${mesAno(t.mes)} · ${ROTULO_REGIME[t.regime]}`;

export default async function Precos({ searchParams }: { searchParams: Promise<Busca> }) {
  const q = await searchParams;
  const ator = comoAtor(await exigirUsuario());
  if (!pode(ator, "orcamento.ver")) return <div className="cartao vazio"><b>Seu perfil não acessa a base de preços</b>Peça o acesso ao administrador do sistema.</div>;
  const ver = (["composicoes", "insumos", "cargas", "proprias"].includes(q.ver ?? "") ? q.ver : "composicoes") as string;
  const tabelas = await listarTabelas(ator);
  const liberadas = tabelas.filter((t) => t.situacao === "liberada");
  const tabela = liberadas.find((t) => t.id === q.tabela) ?? liberadas[0];
  const aviso = avisoDaBase(tabelas, new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()));
  const link = (v: string) => `/precos?ver=${v}${tabela ? `&tabela=${tabela.id}` : ""}`;

  const composicoes = ver === "composicoes" && tabela ? await buscarComposicoes(ator, { tabelaId: tabela.id, busca: q.busca, limite: 60 }) : [];
  const insumos = ver === "insumos" && tabela ? await buscarInsumos(ator, { tabelaId: tabela.id, busca: q.busca, tipo: (q.tipo || "") as TipoInsumo | "", limite: 100 }) : [];
  const proprias = ver === "proprias" ? await listarComposicoesProprias(ator) : [];

  return (
    <>
      <div className="cabecalho">
        <div>
          <div className="sobretitulo">Custos</div>
          <h1 className="titulo">Base de preços</h1>
          <p className="subtitulo">{tabela ? `Referência: ${rotuloTabela(tabela)}` : "Nenhuma base liberada."}</p>
        </div>
        {pode(ator, "precos.composicao_propria") && (
          <Link href={`/precos/composicoes/nova${tabela ? `?tabela=${tabela.id}` : ""}`} className="botao botao-primario"><Plus /> Composição própria</Link>
        )}
      </div>

      {aviso && <div className="aviso aviso-info" style={{ marginBottom: 14 }}><span>{aviso}</span></div>}

      <nav className="abas" aria-label="Seções da base de preços">
        {[["composicoes", "Composições"], ["insumos", "Insumos"], ["proprias", "Próprias"], ["cargas", "Cargas"]].map(([v, r]) => (
          <Link key={v} href={link(v)} className={`aba ${ver === v ? "aba-ativa" : ""}`} aria-current={ver === v ? "page" : undefined}>{r}</Link>
        ))}
      </nav>

      {(ver === "composicoes" || ver === "insumos") && tabela && (
        <form className="form-linha" action="/precos" style={{ marginBottom: 16 }}>
          <input type="hidden" name="ver" value={ver} />
          <select name="tabela" className="entrada-texto" defaultValue={tabela.id} aria-label="Base" style={{ width: 300 }}>
            {liberadas.map((t) => <option key={t.id} value={t.id}>{rotuloTabela(t)}</option>)}
          </select>
          <div className="busca-campo">
            <Search />
            <input name="busca" type="search" defaultValue={q.busca} placeholder="Código ou descrição" aria-label="Buscar" />
          </div>
          {ver === "insumos" && (
            <select name="tipo" className="entrada-texto" defaultValue={q.tipo ?? ""} aria-label="Tipo" style={{ width: 170 }}>
              <option value="">Todos os tipos</option>
              {(Object.keys(ROTULO_TIPO_INSUMO) as TipoInsumo[]).map((t) => <option key={t} value={t}>{ROTULO_TIPO_INSUMO[t]}</option>)}
            </select>
          )}
          <button className="botao botao-neutro">Buscar</button>
        </form>
      )}

      {(ver === "composicoes" || ver === "insumos") && !tabela && (
        <div className="cartao vazio"><b>Nenhuma base liberada</b>Veja a situação em Cargas.</div>
      )}

      {ver === "composicoes" && tabela && (
        composicoes.length === 0 ? <div className="cartao vazio"><b>Nenhuma composição encontrada</b></div> : (
          <div className="tabela-caixa surgir">
            <table className="tabela tabela-compacta">
              <thead><tr><th>Código</th><th>Descrição</th><th>Grupo</th><th>Und.</th><th className="dir">Material</th><th className="dir">Mão de obra</th><th className="dir">Equip.</th><th className="dir">Custo</th></tr></thead>
              <tbody>
                {composicoes.map((k) => (
                  <tr key={k.id}>
                    <td className="num fraco" style={{ whiteSpace: "nowrap" }}>{ROTULO_FONTE[k.fonte]} {k.codigo}</td>
                    <td><Link href={`/precos/composicoes/${k.id}?tabela=${tabela.id}`} className="link-item">{k.descricao}</Link>{!k.aprovada && <> <span className="etiqueta et-laranja">Aguardando aprovação</span></>}</td>
                    <td className="fraco">{k.grupo ?? "—"}</td>
                    <td>{unidadeMedida(k.unidade)}</td>
                    <td className="dir num">{moeda(k.material)}</td>
                    <td className="dir num">{moeda(k.maoDeObra)}</td>
                    <td className="dir num">{moeda(k.equipamento)}</td>
                    <td className="dir num forte">{k.custo ? moeda(k.custo) : <span className="etiqueta et-vermelha">Sem preço</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {ver === "insumos" && tabela && (
        insumos.length === 0 ? <div className="cartao vazio"><b>Nenhum insumo encontrado</b></div> : (
          <div className="tabela-caixa surgir">
            <table className="tabela tabela-compacta">
              <thead><tr><th>Código</th><th>Descrição</th><th>Tipo</th><th>Und.</th><th className="dir">Preço</th></tr></thead>
              <tbody>
                {insumos.map((i) => (
                  <tr key={i.id}>
                    <td className="num fraco">{i.codigo}</td>
                    <td><Link href={`/precos/insumos/${i.id}`} className="link-item">{i.descricao}</Link></td>
                    <td className="fraco">{ROTULO_TIPO_INSUMO[i.tipo]}</td>
                    <td>{unidadeMedida(i.unidade)}</td>
                    <td className="dir num forte">{i.preco ? moeda(i.preco) : <span className="etiqueta et-vermelha">Sem preço</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {ver === "proprias" && (
        proprias.length === 0 ? <div className="cartao vazio"><b>Nenhuma composição própria</b></div> : (
          <div className="tabela-caixa surgir">
            <table className="tabela">
              <thead><tr><th>Código</th><th>Descrição</th><th>Und.</th><th className="dir">Insumos</th><th>Criada por</th><th>Situação</th></tr></thead>
              <tbody>
                {proprias.map((k) => (
                  <tr key={k.id}>
                    <td className="num">{k.codigo}</td>
                    <td><Link href={`/precos/composicoes/${k.id}${tabela ? `?tabela=${tabela.id}` : ""}`} className="link-item">{k.descricao}</Link></td>
                    <td>{unidadeMedida(k.unidade)}</td>
                    <td className="dir num">{k.itens}</td>
                    <td>{k.criadoPor ?? "—"}<br /><span className="fraco num">{dataHora(k.criadoEm)}</span></td>
                    <td>{k.aprovada ? <span className="etiqueta et-verde">Aprovada</span> : <span className="etiqueta et-laranja">Aguardando aprovação</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {ver === "cargas" && (
        tabelas.length === 0 ? <div className="cartao vazio"><b>Nenhuma carga</b></div> : (
          <div className="tabela-caixa surgir">
            <table className="tabela">
              <thead><tr><th>Base</th><th>Arquivo</th><th className="dir">Insumos</th><th className="dir">Composições</th><th>Conferência</th><th>Carregada</th><th>Situação</th></tr></thead>
              <tbody>
                {tabelas.map((t) => {
                  const c = t.conferencia as { conferidas?: number; divergentes?: number };
                  const [rot, cor] = ROTULO_CARGA[t.situacao];
                  return (
                    <tr key={t.id}>
                      <td className="forte">{rotuloTabela(t)}</td>
                      <td className="fraco">{t.arquivo ?? "—"}</td>
                      <td className="dir num">{t.precos.toLocaleString("pt-BR")}</td>
                      <td className="dir num">{t.composicoes.toLocaleString("pt-BR")}</td>
                      <td>{c.conferidas ? `${c.conferidas.toLocaleString("pt-BR")} conferidas, ${c.divergentes ?? 0} divergentes` : "—"}</td>
                      <td className="num">{dataHora(t.carregadaEm)}</td>
                      <td><span className={`etiqueta ${cor}`}>{rot}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}
    </>
  );
}
