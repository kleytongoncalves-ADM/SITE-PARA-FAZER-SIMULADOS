/** Mostrado na hora do clique, enquanto a página busca os dados. */
export default function Carregando() {
  return (
    <div className="esqueleto" aria-busy="true" aria-label="Carregando">
      <span className="esq esq-sobre" />
      <span className="esq esq-titulo" />
      <span className="esq esq-linha" />
      <div className="esq-grade">
        <span className="esq esq-cartao" />
        <span className="esq esq-cartao" />
        <span className="esq esq-cartao" />
      </div>
    </div>
  );
}
