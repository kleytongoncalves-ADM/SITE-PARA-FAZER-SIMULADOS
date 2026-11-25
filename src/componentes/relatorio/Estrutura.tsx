/** Peças de layout do relatório: cabeçalho de documento, seção numerada e indicadores. */
import Image from "next/image";

export function CabecalhoRelatorio({ orgao, tipo, titulo, subtitulo, selo, dados }: {
  orgao: string; tipo: string; titulo: string; subtitulo?: string; selo?: { texto: string; cor: "verde" | "laranja" | "vermelho" | "neutro" };
  dados: [string, React.ReactNode][];
}) {
  return (
    <header className="rel-cabecalho">
      <div className="rel-faixa">
        <div className="rel-faixa-marca">
          <Image src="/marca/logo.png" alt="CiviObras" width={150} height={32} />
          <span>{orgao}</span>
        </div>
        <div className="rel-faixa-titulo">
          <span className="rel-tipo">{tipo}</span>
          <h2>{titulo}</h2>
          {subtitulo && <p>{subtitulo}</p>}
        </div>
        {selo && <span className={`rel-selo rel-selo-${selo.cor}`}>{selo.texto}</span>}
      </div>
      <dl className="rel-identificacao">
        {dados.map(([r, v]) => <div key={r}><dt>{r}</dt><dd>{v || "—"}</dd></div>)}
      </dl>
    </header>
  );
}

export function Secao({ numero, titulo, children, quebra, descricao }: { numero: number; titulo: string; children: React.ReactNode; quebra?: boolean; descricao?: string }) {
  return (
    <section className={`rel-secao ${quebra ? "rel-quebra" : ""}`}>
      <h3 className="rel-secao-titulo"><span className="num">{String(numero).padStart(2, "0")}</span>{titulo}</h3>
      {descricao && <p className="rel-secao-desc">{descricao}</p>}
      {children}
    </section>
  );
}

export function Indicadores({ itens }: { itens: { rotulo: string; valor: React.ReactNode; detalhe?: React.ReactNode; destaque?: boolean }[] }) {
  return (
    <div className="rel-indicadores">
      {itens.map((i) => (
        <div key={i.rotulo} className={`rel-indicador ${i.destaque ? "rel-indicador-destaque" : ""}`}>
          <span>{i.rotulo}</span><b className="num">{i.valor}</b>{i.detalhe && <small>{i.detalhe}</small>}
        </div>
      ))}
    </div>
  );
}

export function RodapeRelatorio({ texto }: { texto: string }) {
  return <footer className="rel-rodape"><span>{texto}</span><span className="rel-rodape-pagina" /></footer>;
}
