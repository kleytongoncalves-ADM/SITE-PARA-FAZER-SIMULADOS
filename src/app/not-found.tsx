import Link from "next/link";

export default function NaoEncontrada() {
  return (
    <main className="nao-encontrada">
      <div className="cartao-escuro nao-encontrada-caixa entrada">
        <span className="nao-encontrada-codigo num">404</span>
        <h1>Página não encontrada</h1>
        <p>O endereço não existe ou o registro está fora do seu acesso.</p>
        <Link href="/inicio" className="botao botao-primario">Voltar ao início</Link>
      </div>
    </main>
  );
}
