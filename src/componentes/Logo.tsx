import Image from "next/image";

/** Ícone do CiviObras: capacete laranja sobre os edifícios. */
export function Logo({ tamanho = 40 }: { tamanho?: number }) {
  return (
    <Image src="/marca/icone-192.png" alt="" width={tamanho} height={tamanho} priority
      style={{ flex: "none", borderRadius: tamanho * 0.22, boxShadow: "0 8px 18px -6px rgba(0,0,0,0.6)" }} />
  );
}

/** Logo horizontal, com fundo transparente. Feito para fundo escuro. */
export function LogoHorizontal({ largura = 190 }: { largura?: number }) {
  return (
    <Image src="/marca/logo.png" alt="CiviObras" width={largura} height={Math.round((largura * 199) / 930)} priority
      style={{ flex: "none", height: "auto", maxWidth: "100%" }} />
  );
}
