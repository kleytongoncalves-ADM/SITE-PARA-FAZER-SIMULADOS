"use client";

export default function Erro({ reset }: { error: Error; reset: () => void }) {
  return (
    <main style={{ maxWidth: 520, margin: "12vh auto", padding: "0 16px" }}>
      <div className="cartao vazio">
        <b>Não foi possível carregar esta tela</b>
        Seus dados não foram alterados. Tente de novo e, se continuar, avise o administrador do sistema.
        <div style={{ marginTop: 16 }}>
          <button className="botao botao-primario" onClick={reset}>Tentar de novo</button>
        </div>
      </div>
    </main>
  );
}
