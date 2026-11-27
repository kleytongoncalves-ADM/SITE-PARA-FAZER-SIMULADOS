import { Casca } from "@/componentes/Casca";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { listarObras } from "@/servicos/obras";
import { naoLidasDoOrgao } from "@/servicos/comunicacao";
import { pode } from "@/servicos/permissoes";
import { ROTULO_PERFIL } from "@/servicos/rotulos";

export default async function LayoutSistema({ children }: { children: React.ReactNode }) {
  const u = await exigirUsuario();
  const ator = comoAtor(u);
  const [obras, conversasNaoLidas] = await Promise.all([listarObras(ator), naoLidasDoOrgao(ator).catch(() => 0)]);
  return (
    <Casca
      nome={u.nome}
      perfil={u.administrador ? `${ROTULO_PERFIL[u.perfil]} · Administrador` : ROTULO_PERFIL[u.perfil]}
      orgao={u.orgaoNome}
      totalObras={obras.length}
      podeCriarObra={pode(ator, "obra.criar")}
      podeGerenciarUsuarios={pode(ator, "usuario.gerenciar")}
      podeVerOrcamento={pode(ator, "orcamento.ver")}
      podeVerContratos={pode(ator, "contrato.ver")}
      podeVerCronograma={pode(ator, "cronograma.ver")}
      podeVerMedicoes={pode(ator, "medicao.ver")}
      podeVerDiario={pode(ator, "diario.ver")}
      podeVerQualidade={pode(ator, "qualidade.ver")}
      podeVerSeguranca={pode(ator, "seguranca.ver")}
      podeVerSuprimentos={pode(ator, "suprimentos.ver")}
      podeVerEquipes={pode(ator, "equipes.ver")}
      podeVerDocumentos={pode(ator, "documentos.ver")}
      podeVerGerencial={pode(ator, "gerencial.ver")}
      podeVerAuditoria={pode(ator, "auditoria.ver")}
      conversasNaoLidas={conversasNaoLidas}
    >
      {children}
    </Casca>
  );
}
