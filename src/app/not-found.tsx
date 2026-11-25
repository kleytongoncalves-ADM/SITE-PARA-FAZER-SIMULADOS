import Link from "next/link";

export default function NaoEncontrada() {
  return (
    <main className="login">
      <div className="vidro login-caixa entrada" style={{ textAlign: "center" }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 26, fontWeight: 700 }}>Página não encontrada</h1>
        <p style={{ margin: "0 0 22px", fontSize: 14, color: "var(--texto-escuro-fundo-suave)" }}>
          O endereço não existe ou o registro está fora do seu acesso.
        </p>
        <Link href="/inicio" className="botao botao-primario">Voltar ao início</Link>
      </div>
    </main>
  );
}
