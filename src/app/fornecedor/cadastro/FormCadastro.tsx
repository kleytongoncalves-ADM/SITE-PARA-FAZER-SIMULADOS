"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ArrowRight, CircleAlert, Eye, EyeOff, LogIn } from "lucide-react";
import { acaoCadastrarFornecedor, acaoConferirCnpj, type EstadoCadastro } from "../acoes";

const mascaraCnpj = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
};
function cnpjValido(v: string) {
  const d = v.replace(/\D/g, "");
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const calc = (n: number) => { const p = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]; const r = p.reduce((t, x, i) => t + x * Number(d[i]), 0) % 11; return r < 2 ? 0 : 11 - r; };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

type Inicial = { cnpj?: string; razaoSocial?: string; email?: string };

export function FormCadastro({ voltar, entrar, inicial }: { voltar: string; entrar: string; inicial: Inicial }) {
  const [estado, acao, enviando] = useActionState<EstadoCadastro, FormData>(acaoCadastrarFornecedor, {});
  const v = { ...inicial, ...(estado.valores ?? {}) } as Record<string, string | undefined>;
  const [cnpj, setCnpj] = useState(mascaraCnpj(v.cnpj ?? ""));
  const [aviso, setAviso] = useState<{ erro?: string; jaTem?: string }>({});
  const [verSenha, setVerSenha] = useState(false);
  const jaTem = aviso.jaTem ?? estado.jaTem;
  const erro = (k: string) => estado.erros?.[k] ? <span className="erro">{estado.erros[k]}</span> : null;

  async function conferir() {
    if (!cnpj) return setAviso({});
    if (!cnpjValido(cnpj)) return setAviso({ erro: "CNPJ inválido." });
    const r = await acaoConferirCnpj(cnpj).catch(() => ({ livre: true } as { livre: boolean; email?: string }));
    setAviso(r.livre ? {} : { jaTem: r.email ?? "" });
  }

  return (
    <form action={acao} className="cadastro-form">
      <input type="hidden" name="voltar" value={voltar} />
      {estado.erro && <div className="aviso aviso-erro" role="alert"><CircleAlert />{estado.erro}</div>}
      {jaTem !== undefined && (
        <div className="aviso aviso-info" role="status">
          <span>Esta empresa já tem cadastro{jaTem ? `, com o acesso ${jaTem}` : ""}. Entre com esse e-mail.</span>
          <Link href={entrar} className="botao botao-primario botao-pequeno"><LogIn /> Entrar</Link>
        </div>
      )}

      <fieldset>
        <legend><i>1</i> Empresa</legend>
        <div className="grade-form">
          <div className="campo c5">
            <label htmlFor="c-cnpj">CNPJ</label>
            <input id="c-cnpj" name="cnpj" className="entrada-texto" inputMode="numeric" autoComplete="off" required value={cnpj}
              onChange={(e) => { setCnpj(mascaraCnpj(e.target.value)); setAviso({}); }} onBlur={conferir} placeholder="00.000.000/0000-00" />
            {aviso.erro ? <span className="erro">{aviso.erro}</span> : erro("cnpj")}
          </div>
          <div className="campo c7"><label htmlFor="c-razao">Razão social</label><input id="c-razao" name="razaoSocial" className="entrada-texto" required maxLength={160} defaultValue={v.razaoSocial} />{erro("razaoSocial")}</div>
          <div className="campo c6"><label htmlFor="c-fantasia">Nome fantasia <small>opcional</small></label><input id="c-fantasia" name="nomeFantasia" className="entrada-texto" maxLength={160} defaultValue={v.nomeFantasia} /></div>
          <div className="campo c6"><label htmlFor="c-tel">Telefone</label><input id="c-tel" name="telefone" className="entrada-texto" inputMode="tel" autoComplete="tel" maxLength={40} defaultValue={v.telefone} /></div>
          <div className="campo c9"><label htmlFor="c-cidade">Cidade</label><input id="c-cidade" name="cidade" className="entrada-texto" autoComplete="address-level2" maxLength={80} defaultValue={v.cidade} /></div>
          <div className="campo c3"><label htmlFor="c-uf">UF</label><input id="c-uf" name="uf" className="entrada-texto" maxLength={2} autoComplete="address-level1" defaultValue={v.uf} style={{ textTransform: "uppercase" }} />{erro("uf")}</div>
        </div>
      </fieldset>

      <fieldset>
        <legend><i>2</i> Acesso</legend>
        <div className="grade-form">
          <div className="campo c12"><label htmlFor="c-nome">Nome do responsável</label><input id="c-nome" name="nome" className="entrada-texto" required autoComplete="name" maxLength={120} defaultValue={v.nome} />{erro("nome")}</div>
          <div className="campo c7"><label htmlFor="c-email">E-mail de acesso</label><input id="c-email" name="email" type="email" className="entrada-texto" required autoComplete="email" maxLength={160} defaultValue={v.email} />{erro("email")}</div>
          <div className="campo c5">
            <label htmlFor="c-senha">Senha</label>
            <div className="campo-senha">
              <input id="c-senha" name="senha" type={verSenha ? "text" : "password"} className="entrada-texto" required minLength={6} maxLength={10} autoComplete="new-password" />
              <button type="button" onClick={() => setVerSenha(!verSenha)} aria-label={verSenha ? "Esconder senha" : "Mostrar senha"}>{verSenha ? <EyeOff /> : <Eye />}</button>
            </div>
            {erro("senha") ?? <span className="dica">6 a 10 caracteres, com letra, número e caractere especial.</span>}
          </div>
        </div>
      </fieldset>

      <button className="botao botao-primario" disabled={enviando || !!jaTem} style={{ height: 48 }}>
        {enviando ? "Cadastrando…" : voltar === "/fornecedor" ? "Cadastrar e entrar" : "Cadastrar e abrir a cotação"}<ArrowRight />
      </button>
    </form>
  );
}
