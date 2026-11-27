"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  Ban, Building2, Check, CircleCheck, Copy, Dot, Eye, EyeOff, KeyRound, RotateCcw, Save, UserCheck, UserPlus, UserX, Wand2,
} from "lucide-react";
import { Avisos } from "@/componentes/Avisos";
import { DICA_SENHA, PERFIS, ROTULO_PERFIL, SENHA_MAX, SENHA_MIN, type Perfil } from "@/servicos/rotulos";
import type { Estado } from "../../(sistema)/obras/acoes";
import {
  acaoAlterarEmpresa, acaoAlterarFuncionario, acaoCriarEmpresa, acaoCriarFuncionario, acaoEmpresaAtiva,
  acaoFuncionarioAtivo, acaoRedefinirSenha, acaoTrocarMinhaSenha,
} from "../acoes";

const ESFERAS: [string, string][] = [
  ["empresa_privada", "Empresa privada"],
  ["municipal", "Prefeitura / órgão municipal"],
  ["estadual", "Órgão estadual"],
  ["federal", "Órgão federal"],
  ["empresa_publica", "Empresa pública"],
];

type Valores = Record<string, string | undefined>;

function Campo({ id, rotulo, erro, dica, children }: { id: string; rotulo: string; erro?: string; dica?: string; children: React.ReactNode }) {
  return (
    <div className="campo">
      <label htmlFor={id}>{rotulo}</label>
      {children}
      {erro ? <span className="erro">{erro}</span> : dica ? <span className="dica">{dica}</span> : null}
    </div>
  );
}

export function FormEmpresa({ empresaId, inicial, aoConcluir }: { empresaId?: string; inicial?: Valores; aoConcluir?: () => void }) {
  const acaoBase = empresaId ? acaoAlterarEmpresa.bind(null, empresaId) : acaoCriarEmpresa;
  const [estado, acao, enviando] = useActionState<Estado, FormData>(acaoBase, {});
  const ultimo = useRef(estado);
  useEffect(() => {
    if (estado === ultimo.current) return;
    ultimo.current = estado;
    if (estado.ok) aoConcluir?.();
  }, [estado, aoConcluir]);
  const v = (k: string) => estado.valores?.[k] ?? inicial?.[k] ?? "";
  const e = (k: string) => estado.erros?.[k];
  const p = empresaId ? `e-${empresaId}-` : "nova-";
  return (
    <form action={acao} style={{ display: "grid", gap: 14 }}>
      <Avisos erro={estado.erro} ok={aoConcluir ? undefined : estado.ok} />
      <Campo id={p + "nome"} rotulo="Nome" erro={e("nome")}>
        <input id={p + "nome"} name="nome" className="entrada-texto" required defaultValue={v("nome")} aria-invalid={!!e("nome")} />
      </Campo>
      <Campo id={p + "cnpj"} rotulo="CNPJ" erro={e("cnpj")}>
        <input id={p + "cnpj"} name="cnpj" inputMode="numeric" className="entrada-texto" defaultValue={v("cnpj")} aria-invalid={!!e("cnpj")} placeholder="00.000.000/0000-00" />
      </Campo>
      <Campo id={p + "esfera"} rotulo="Tipo" erro={e("esfera")}>
        <select id={p + "esfera"} name="esfera" className="entrada-texto" defaultValue={v("esfera") || "empresa_privada"}>
          {ESFERAS.map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
        </select>
      </Campo>
      <div className="instalacao-dupla">
        <Campo id={p + "municipio"} rotulo="Município">
          <input id={p + "municipio"} name="municipio" className="entrada-texto" defaultValue={v("municipio")} />
        </Campo>
        <Campo id={p + "uf"} rotulo="UF" erro={e("uf")}>
          <input id={p + "uf"} name="uf" maxLength={2} required className="entrada-texto" defaultValue={v("uf") || "RJ"} style={{ textTransform: "uppercase" }} aria-invalid={!!e("uf")} />
        </Campo>
      </div>
      <div className="janela-acoes">
        {aoConcluir && <button type="button" className="botao botao-neutro" onClick={aoConcluir}>Cancelar</button>}
        <button className="botao botao-primario" disabled={enviando}>
          {empresaId ? <Save /> : <Building2 />}
          {enviando ? "Salvando…" : empresaId ? "Salvar" : "Cadastrar"}
        </button>
      </div>
    </form>
  );
}

export function BotaoEmpresaAtiva({ empresaId, ativo }: { empresaId: string; ativo: boolean }) {
  const [estado, acao, enviando] = useActionState<Estado, FormData>(acaoEmpresaAtiva.bind(null, empresaId, !ativo), {});
  return (
    <form
      action={acao}
      onSubmit={(ev) => {
        if (ativo && !confirm("Desativar a empresa? Os funcionários perdem o acesso.")) ev.preventDefault();
      }}
    >
      <button className={ativo ? "botao botao-neutro botao-perigo" : "botao botao-neutro"} disabled={enviando}>
        {ativo ? <Ban /> : <RotateCcw />}
        {enviando ? "Salvando…" : <>{ativo ? "Desativar" : "Reativar"}<span className="so-largo"> empresa</span></>}
      </button>
      {estado.erro && <div className="erro-acao" role="alert">{estado.erro}</div>}
    </form>
  );
}

// ---------------------------------------------------------------------------
// Senha: mostrar, gerar e conferir as regras enquanto digita
// ---------------------------------------------------------------------------

const REGRAS_SENHA: [string, (s: string) => boolean][] = [
  [`${SENHA_MIN} a ${SENHA_MAX} caracteres`, (s) => s.length >= SENHA_MIN && s.length <= SENHA_MAX],
  ["Letra", (s) => /[a-zA-Z]/.test(s)],
  ["Número", (s) => /[0-9]/.test(s)],
  ["Caractere especial", (s) => /[^a-zA-Z0-9\s]/.test(s)],
];

function sortear(n: number) {
  const v = new Uint32Array(1);
  crypto.getRandomValues(v);
  return v[0] % n;
}

/** Senha de 8 caracteres que já cumpre a regra: 5 letras, 2 números e 1 especial. */
export function gerarSenha(): string {
  const letras = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
  const numeros = "23456789";
  const especiais = "@#$%&*!?";
  const partes = [
    ...Array.from({ length: 5 }, () => letras[sortear(letras.length)]),
    ...Array.from({ length: 2 }, () => numeros[sortear(numeros.length)]),
    especiais[sortear(especiais.length)],
  ];
  for (let i = partes.length - 1; i > 0; i--) {
    const j = sortear(i + 1);
    [partes[i], partes[j]] = [partes[j], partes[i]];
  }
  return partes.join("");
}

function CampoSenha({ id, rotulo, erro, valor, aoMudar }: {
  id: string; rotulo: string; erro?: string; valor: string; aoMudar: (v: string) => void;
}) {
  const [visivel, setVisivel] = useState(false);
  return (
    <div className="campo">
      <label htmlFor={id}>{rotulo}</label>
      <div className="senha-linha">
        <div className="senha-entrada">
          <input
            id={id} name="senha" type={visivel ? "text" : "password"} autoComplete="new-password" required
            minLength={SENHA_MIN} maxLength={SENHA_MAX} className="entrada-texto num" aria-invalid={!!erro}
            value={valor} onChange={(e) => aoMudar(e.target.value)} spellCheck={false}
          />
          <button type="button" className="senha-olho" onClick={() => setVisivel(!visivel)} aria-label={visivel ? "Ocultar senha" : "Mostrar senha"} title={visivel ? "Ocultar" : "Mostrar"}>
            {visivel ? <EyeOff /> : <Eye />}
          </button>
        </div>
        <button type="button" className="botao botao-neutro" onClick={() => { aoMudar(gerarSenha()); setVisivel(true); }}>
          <Wand2 />Gerar
        </button>
      </div>
      <ul className="senha-regras" aria-label="Regras da senha">
        {REGRAS_SENHA.map(([texto, ok]) => (
          <li key={texto} className={ok(valor) ? "ok" : ""}>{ok(valor) ? <Check /> : <Dot />}{texto}</li>
        ))}
      </ul>
      {erro && <span className="erro">{erro}</span>}
    </div>
  );
}

function BotaoCopiar({ texto, rotulo = "Copiar" }: { texto: string; rotulo?: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      type="button"
      className="botao botao-neutro"
      onClick={async () => {
        try { await navigator.clipboard.writeText(texto); setCopiado(true); setTimeout(() => setCopiado(false), 1800); } catch {}
      }}
    >
      {copiado ? <Check /> : <Copy />}{copiado ? "Copiado" : rotulo}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Funcionários
// ---------------------------------------------------------------------------

type Credenciais = { nome: string; email: string; senha: string; perfil: string };

export function FormFuncionario({ orgaoId, usuarioId, inicial, administrador, aoConcluir }: {
  orgaoId: string; usuarioId?: string; inicial?: Valores; administrador?: boolean; aoConcluir?: () => void;
}) {
  const acaoBase = usuarioId ? acaoAlterarFuncionario.bind(null, orgaoId, usuarioId) : acaoCriarFuncionario.bind(null, orgaoId);
  const [estado, acao, enviando] = useActionState<Estado, FormData>(acaoBase, {});
  const novo = !usuarioId;
  const [senha, setSenha] = useState("");
  const [rodada, setRodada] = useState(0);
  const enviado = useRef<Credenciais | null>(null);
  const [criado, setCriado] = useState<Credenciais | null>(null);
  const ultimo = useRef(estado);

  useEffect(() => {
    if (estado === ultimo.current) return;
    ultimo.current = estado;
    if (!estado.ok) return;
    if (novo) setCriado(enviado.current);
    else aoConcluir?.();
  }, [estado, novo, aoConcluir]);

  if (criado) {
    const login = typeof window === "undefined" ? "/login" : `${window.location.origin}/login`;
    const texto = `Acesso ao CiviObras\nEndereço: ${login}\nE-mail: ${criado.email}\nSenha: ${criado.senha}`;
    return (
      <div className="acesso-criado">
        <div className="acesso-criado-titulo"><CircleCheck />{criado.nome} cadastrado</div>
        <dl className="acesso-dados">
          <div><dt>Cargo</dt><dd>{ROTULO_PERFIL[criado.perfil as Perfil] ?? criado.perfil}</dd></div>
          <div><dt>E-mail</dt><dd>{criado.email}</dd></div>
          <div><dt>Senha</dt><dd className="num">{criado.senha}</dd></div>
          <div><dt>Endereço</dt><dd>{login}</dd></div>
        </dl>
        <p className="fraco">A senha não aparece de novo depois de fechar esta janela.</p>
        <div className="janela-acoes">
          <BotaoCopiar texto={texto} rotulo="Copiar acesso" />
          <button type="button" className="botao botao-neutro" onClick={() => { setCriado(null); setSenha(""); setRodada((r) => r + 1); }}>
            <UserPlus />Cadastrar outro
          </button>
          <button type="button" className="botao botao-primario" onClick={() => aoConcluir?.()}>Concluir</button>
        </div>
      </div>
    );
  }

  const v = (k: string) => estado.valores?.[k] ?? inicial?.[k] ?? "";
  const e = (k: string) => estado.erros?.[k];
  const p = usuarioId ? `f-${usuarioId}-` : "novo-";
  return (
    <form
      key={rodada}
      action={acao}
      className="form-funcionario"
      onSubmit={(ev) => {
        const f = new FormData(ev.currentTarget);
        enviado.current = { nome: String(f.get("nome") ?? "").trim(), email: String(f.get("email") ?? "").trim().toLowerCase(), senha, perfil: String(f.get("perfil") ?? "") };
      }}
    >
      <Avisos erro={estado.erro} />
      <Campo id={p + "nome"} rotulo="Nome completo" erro={e("nome")}>
        <input id={p + "nome"} name="nome" className="entrada-texto" required autoFocus={novo} defaultValue={rodada ? "" : v("nome")} aria-invalid={!!e("nome")} />
      </Campo>
      <Campo id={p + "email"} rotulo="E-mail de acesso" erro={e("email")}>
        <input id={p + "email"} name="email" type="email" autoComplete="off" className="entrada-texto" required defaultValue={rodada ? "" : v("email")} aria-invalid={!!e("email")} />
      </Campo>
      <div className="form-par">
        <Campo id={p + "perfil"} rotulo="Cargo" erro={e("perfil")}>
          <select id={p + "perfil"} name="perfil" className="entrada-texto" defaultValue={v("perfil") || "gestor_contrato"}>
            {PERFIS.map((x) => <option key={x} value={x}>{ROTULO_PERFIL[x]}</option>)}
          </select>
        </Campo>
        <Campo id={p + "registroProfissional"} rotulo="CREA/CAU (opcional)">
          <input id={p + "registroProfissional"} name="registroProfissional" className="entrada-texto" defaultValue={rodada ? "" : v("registroProfissional")} />
        </Campo>
      </div>
      {novo && <CampoSenha id={p + "senha"} rotulo="Senha inicial" erro={e("senha")} valor={senha} aoMudar={setSenha} />}
      <label className="interruptor">
        <input type="checkbox" name="administrador" defaultChecked={!!administrador} />
        <span className="interruptor-trilho" aria-hidden="true" />
        <span>Administrador da empresa</span>
      </label>
      <div className="janela-acoes">
        {aoConcluir && <button type="button" className="botao botao-neutro" onClick={aoConcluir}>Cancelar</button>}
        <button className="botao botao-primario" disabled={enviando}>
          {novo ? <UserPlus /> : <Save />}
          {enviando ? "Salvando…" : novo ? "Cadastrar" : "Salvar"}
        </button>
      </div>
    </form>
  );
}

export function FormSenha({ orgaoId, usuarioId, aoConcluir }: { orgaoId: string; usuarioId: string; aoConcluir?: () => void }) {
  const [estado, acao, enviando] = useActionState<Estado, FormData>(acaoRedefinirSenha.bind(null, orgaoId, usuarioId), {});
  const [senha, setSenha] = useState("");
  const e = estado.erros?.senha;
  if (estado.ok) {
    return (
      <div className="acesso-criado">
        <div className="acesso-criado-titulo"><CircleCheck />Senha alterada</div>
        <dl className="acesso-dados"><div><dt>Nova senha</dt><dd className="num">{senha}</dd></div></dl>
        <p className="fraco">As sessões abertas dessa pessoa foram encerradas.</p>
        <div className="janela-acoes">
          <BotaoCopiar texto={senha} rotulo="Copiar senha" />
          <button type="button" className="botao botao-primario" onClick={() => aoConcluir?.()}>Concluir</button>
        </div>
      </div>
    );
  }
  return (
    <form action={acao} className="form-funcionario">
      <Avisos erro={e ? undefined : estado.erro} />
      <CampoSenha id={`s-${usuarioId}`} rotulo="Nova senha" erro={e} valor={senha} aoMudar={setSenha} />
      <div className="janela-acoes">
        {aoConcluir && <button type="button" className="botao botao-neutro" onClick={aoConcluir}>Cancelar</button>}
        <button className="botao botao-primario" disabled={enviando}><KeyRound />{enviando ? "Salvando…" : "Salvar senha"}</button>
      </div>
    </form>
  );
}

export function BotaoFuncionarioAtivo({ orgaoId, usuarioId, ativo, nome }: { orgaoId: string; usuarioId: string; ativo: boolean; nome: string }) {
  const [estado, acao, enviando] = useActionState<Estado, FormData>(acaoFuncionarioAtivo.bind(null, orgaoId, usuarioId, !ativo), {});
  return (
    <form
      action={acao}
      onSubmit={(ev) => {
        if (ativo && !confirm(`Desativar o acesso de ${nome}?`)) ev.preventDefault();
      }}
    >
      <button
        className={ativo ? "icone-acao icone-perigo" : "icone-acao"}
        disabled={enviando}
        aria-label={`${ativo ? "Desativar" : "Reativar"} o acesso de ${nome}`}
        title={ativo ? "Desativar acesso" : "Reativar acesso"}
      >
        {ativo ? <UserX /> : <UserCheck />}
      </button>
      {estado.erro && <div className="erro-acao" role="alert">{estado.erro}</div>}
    </form>
  );
}

export function FormMinhaSenha() {
  const [estado, acao, enviando] = useActionState<Estado, FormData>(acaoTrocarMinhaSenha, {});
  const e = (k: string) => estado.erros?.[k];
  return (
    <form action={acao} style={{ display: "grid", gap: 12 }} key={estado.ok ?? "minha-senha"}>
      <Avisos erro={estado.erros ? undefined : estado.erro} ok={estado.ok} />
      <Campo id="atual" rotulo="Senha atual" erro={e("atual")}>
        <input id="atual" name="atual" type="password" autoComplete="current-password" required className="entrada-texto" aria-invalid={!!e("atual")} />
      </Campo>
      <Campo id="nova" rotulo="Nova senha" erro={e("nova")} dica={DICA_SENHA}>
        <input id="nova" name="nova" type="password" autoComplete="new-password" required minLength={SENHA_MIN} maxLength={SENHA_MAX} className="entrada-texto" aria-invalid={!!e("nova")} />
      </Campo>
      <Campo id="nova2" rotulo="Repita a nova senha" erro={e("nova2")}>
        <input id="nova2" name="nova2" type="password" autoComplete="new-password" required minLength={SENHA_MIN} maxLength={SENHA_MAX} className="entrada-texto" aria-invalid={!!e("nova2")} />
      </Campo>
      <button className="botao botao-primario" disabled={enviando}><KeyRound />{enviando ? "Salvando…" : "Salvar senha"}</button>
    </form>
  );
}
