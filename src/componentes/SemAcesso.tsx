import Link from "next/link";
import { LockKeyhole } from "lucide-react";

/** Aviso de acesso negado, no mesmo padrão das telas vazias. */
export function SemAcesso({ modulo }: { modulo: string }) {
  return (
    <div className="cartao vazio sem-acesso surgir">
      <span className="sem-acesso-icone"><LockKeyhole /></span>
      <b>Sem acesso</b>
      <p>Seu perfil não permite abrir {modulo}. Peça a liberação ao administrador do órgão.</p>
      <Link href="/inicio" className="botao botao-neutro botao-pequeno">Voltar ao início</Link>
    </div>
  );
}
