export default function Carregando() {
  return (
    <div aria-busy="true" aria-label="Carregando" style={{ display: "grid", gap: 16 }}>
      {[52, 120, 260].map((h) => (
        <div key={h} className="cartao" style={{ height: h, opacity: 0.55 }} />
      ))}
    </div>
  );
}
