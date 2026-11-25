// O template é recriado a cada navegação: é ele que dá a entrada com desfoque entre as páginas.
export default function Transicao({ children }: { children: React.ReactNode }) {
  return <div className="entrada">{children}</div>;
}
