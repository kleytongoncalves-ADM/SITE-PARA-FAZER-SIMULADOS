import { paraCampo } from "@/lib/formato";
import {
  formatarCnpj, INDICES, REGIMES, ROTULO_NATUREZA, ROTULO_REGIME_EXECUCAO, type Contrato, type Empresa, type Natureza,
} from "@/servicos/contratos";
import { ROTULO_PERFIL, type Perfil } from "@/servicos/rotulos";

type Pessoa = { id: string; nome: string; perfil: string };

/** Campos do contrato, usados no cadastro e na edição em elaboração. */
export function CamposContrato({ k, empresas, pessoas, sugestao }: {
  k?: Partial<Contrato>; empresas: Empresa[]; pessoas: Pessoa[];
  sugestao?: { objeto?: string; regime?: string; natureza?: Natureza; dataBase?: string };
}) {
  const ativas = empresas.filter((e) => e.ativa && e.tipo === "contratada");
  return (
    <>
      <div className="campo c4"><label htmlFor="numero">Número do contrato</label><input id="numero" name="numero" className="entrada-texto" required defaultValue={k?.numero} placeholder="012/2026" /></div>
      <div className="campo c4"><label htmlFor="processo">Processo administrativo</label><input id="processo" name="processo" className="entrada-texto" defaultValue={k?.processo ?? ""} /></div>
      <div className="campo c4"><label htmlFor="regime">Regime de execução</label>
        <select id="regime" name="regime" className="entrada-texto" defaultValue={k?.regime ?? sugestao?.regime ?? "preco_unitario"}>
          {REGIMES.map((r) => <option key={r} value={r}>{ROTULO_REGIME_EXECUCAO[r]}</option>)}
        </select>
      </div>
      <div className="campo c12"><label htmlFor="objeto">Objeto</label><input id="objeto" name="objeto" className="entrada-texto" required defaultValue={k?.objeto ?? sugestao?.objeto} /></div>
      <div className="campo c6"><label htmlFor="empresaId">Contratada</label>
        <select id="empresaId" name="empresaId" className="entrada-texto" defaultValue={k?.empresaId ?? ""}>
          <option value="">Nenhuma (execução direta)</option>
          {ativas.map((e) => <option key={e.id} value={e.id}>{e.razaoSocial} · {formatarCnpj(e.cnpj)}</option>)}
        </select>
      </div>
      <div className="campo c3"><label htmlFor="natureza">Limite de acréscimo</label>
        <select id="natureza" name="natureza" className="entrada-texto" defaultValue={k?.natureza ?? sugestao?.natureza ?? "obra_nova"}>
          {(Object.keys(ROTULO_NATUREZA) as Natureza[]).map((n) => <option key={n} value={n}>{n === "obra_nova" ? "25%" : "50%"} · {ROTULO_NATUREZA[n]}</option>)}
        </select>
      </div>
      <div className="campo c3"><label htmlFor="desconto">Desconto da proposta (%)</label><input id="desconto" name="desconto" className="entrada-texto num" inputMode="decimal" defaultValue={paraCampo(k?.desconto ?? "0")} /></div>
      <div className="campo c3"><label htmlFor="dataAssinatura">Assinatura</label><input id="dataAssinatura" name="dataAssinatura" type="date" className="entrada-texto" defaultValue={k?.dataAssinatura ?? ""} /></div>
      <div className="campo c3"><label htmlFor="dataOrdemServico">Ordem de serviço</label><input id="dataOrdemServico" name="dataOrdemServico" type="date" className="entrada-texto" defaultValue={k?.dataOrdemServico ?? ""} /></div>
      <div className="campo c3"><label htmlFor="prazoExecucaoDias">Prazo de execução (dias corridos)</label><input id="prazoExecucaoDias" name="prazoExecucaoDias" type="number" min={1} className="entrada-texto num" defaultValue={k?.prazoExecucaoDias ?? ""} /></div>
      <div className="campo c3"><label htmlFor="vigenciaFim">Fim da vigência</label><input id="vigenciaFim" name="vigenciaFim" type="date" className="entrada-texto" defaultValue={k?.vigenciaFim ?? ""} /></div>
      <div className="campo c3"><label htmlFor="dataBase">Data-base do reajuste</label><input id="dataBase" name="dataBase" type="date" className="entrada-texto" defaultValue={k?.dataBase ?? sugestao?.dataBase ?? ""} /></div>
      <div className="campo c3"><label htmlFor="indiceReajuste">Índice de reajuste</label>
        <select id="indiceReajuste" name="indiceReajuste" className="entrada-texto" defaultValue={k?.indiceReajuste ?? "INCC-DI"}>
          <option value="">Sem reajuste</option>
          {INDICES.map((i) => <option key={i} value={i}>{i}</option>)}
        </select>
      </div>
      <div className="campo c3"><label htmlFor="gestorId">Gestor do contrato</label>
        <select id="gestorId" name="gestorId" className="entrada-texto" defaultValue={k?.gestorId ?? ""}>
          <option value="">A designar</option>
          {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome} · {ROTULO_PERFIL[p.perfil as Perfil]}</option>)}
        </select>
      </div>
      <div className="campo c3"><label htmlFor="fiscalId">Fiscal</label>
        <select id="fiscalId" name="fiscalId" className="entrada-texto" defaultValue={k?.fiscalId ?? ""}>
          <option value="">A designar</option>
          {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome} · {ROTULO_PERFIL[p.perfil as Perfil]}</option>)}
        </select>
      </div>
    </>
  );
}
