import type { Metadata } from "next";
import { CircleCheck, CircleDashed, Mail, MessageCircle } from "lucide-react";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { obterConfig } from "@/servicos/comunicacao";
import { pode } from "@/servicos/permissoes";
import { FormCodigo, FormEmailCorporativo, FormLigarEmail, FormTesteWhatsapp, FormWhatsapp } from "./Formularios";

export const metadata: Metadata = { title: "Envio automático · Comunicações" };
export const dynamic = "force-dynamic";

const Estado = ({ ligado, texto }: { ligado: boolean; texto: string }) => (
  <span className={`config-estado ${ligado ? "ligado" : ""}`}>{ligado ? <CircleCheck /> : <CircleDashed />}{texto}</span>
);

export default async function Configuracao() {
  const a = comoAtor(await exigirUsuario());
  const c = await obterConfig(a);
  const admin = pode(a, "usuario.gerenciar");
  return (
    <div className="grade">
      <div className="aviso aviso-info">
        <span>Por padrão, nada é enviado sozinho: a equipe abre o próprio e-mail ou WhatsApp com a mensagem pronta e decide se envia. O envio automático é opcional e vale para todo o órgão.</span>
      </div>

      <div className="forn-colunas">
        <section className="cartao">
          <div className="config-cabeca"><span className="convidar-icone"><Mail /></span><div><h2 className="cartao-titulo">E-mail automático</h2><Estado ligado={c.emailAutomatico} texto={c.emailAutomatico ? "Ligado" : "Desligado"} /></div></div>
          <p className="cartao-sub">Convites e lembretes de prazo saem pelo CiviObras em nome do órgão. A resposta do fornecedor vai para o e-mail corporativo validado.</p>
          {!c.servicoEmail && <div className="aviso aviso-info" style={{ marginTop: 10 }}><span>O serviço de e-mail da plataforma ainda não está ligado. Quem administra o CiviObras precisa cadastrar a chave do Resend no Netlify.</span></div>}
          <ol className="config-passos">
            <li className={c.emailCorporativo ? "feito" : ""}>
              <b>E-mail corporativo</b>
              {c.emailCorporativo ? <span>{c.emailCorporativo}{c.emailNome ? ` · aparece como "${c.emailNome} via CiviObras"` : ""}</span> : <span className="fraco">Ainda não informado.</span>}
              {admin && c.servicoEmail && <FormEmailCorporativo email={c.emailCorporativo} nome={c.emailNome} />}
            </li>
            <li className={c.emailValidado ? "feito" : ""}>
              <b>Validação</b>
              <span className={c.emailValidado ? "" : "fraco"}>{c.emailValidado ? "E-mail validado." : c.codigoPendente ? "Código enviado. Digite os 6 dígitos." : "Depois de informar o e-mail, chega um código para confirmar."}</span>
              {admin && c.codigoPendente && <FormCodigo />}
            </li>
            <li className={c.emailAutomatico ? "feito" : ""}>
              <b>Envio automático</b>
              <span className="fraco">{c.emailAutomatico ? "Os convites saem por e-mail assim que a solicitação é enviada." : "Desligado: os convites ficam na lista para a equipe enviar."}</span>
              {admin && c.emailValidado && <FormLigarEmail ligado={c.emailAutomatico} />}
            </li>
          </ol>
        </section>

        <section className="cartao">
          <div className="config-cabeca"><span className="convidar-icone"><MessageCircle /></span><div><h2 className="cartao-titulo">WhatsApp automático</h2><Estado ligado={c.whatsappAutomatico} texto={c.whatsappAutomatico ? "Ligado" : "Desligado"} /></div></div>
          <p className="cartao-sub">Pela API oficial da Meta (WhatsApp Business Platform), com o número corporativo do órgão. Só recebem os fornecedores que autorizaram avisos por WhatsApp na área deles.</p>
          {admin ? (
            <>
              <FormWhatsapp numeroId={c.whatsappNumeroId} modelo={c.whatsappModelo} comChave={c.whatsappComChave} ligado={c.whatsappAutomatico} />
              {c.whatsappComChave && c.whatsappNumeroId && c.whatsappModelo && <FormTesteWhatsapp />}
            </>
          ) : (
            <p className="fraco" style={{ marginTop: 10 }}>{c.whatsappNumeroId ? `Número configurado (identificador ${c.whatsappNumeroId}).` : "Sem número configurado."}</p>
          )}
          <details className="cot-historico" style={{ marginTop: 14 }}>
            <summary>O que é preciso na Meta</summary>
            <ol>
              <li>Conta no Meta Business Suite com a empresa verificada.</li>
              <li>Um número de celular dedicado, que não esteja em uso no WhatsApp comum.</li>
              <li>Em developers.facebook.com, um app do tipo Empresa com o produto WhatsApp. Ali aparecem o identificador do número e a chave de acesso permanente (usuário do sistema).</li>
              <li>Um modelo de mensagem aprovado, em português, com 4 campos: órgão, título da cotação, prazo e link.</li>
            </ol>
            <p className="fraco">A Meta cobra por conversa iniciada pela empresa.</p>
          </details>
        </section>
      </div>
      {!admin && <p className="fraco">Só o administrador do órgão altera estas configurações.</p>}
    </div>
  );
}
