import { CircleAlert, CircleCheck } from "lucide-react";

export function Avisos({ erro, ok }: { erro?: string; ok?: string }) {
  return (
    <>
      {erro && <div className="aviso aviso-erro" role="alert"><CircleAlert />{erro}</div>}
      {ok && <div className="aviso aviso-ok" role="status"><CircleCheck />{ok}</div>}
    </>
  );
}
