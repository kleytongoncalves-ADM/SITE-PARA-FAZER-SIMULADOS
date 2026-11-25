import { Casca } from "@/componentes/Casca";
import { comoAtor, exigirUsuario } from "@/lib/sessao";
import { listarObras } from "@/servicos/obras";
import { pode } from "@/servicos/permissoes";
import { ROTULO_PERFIL } from "@/servicos/rotulos";

export default async function LayoutSistema({ children }: { children: React.ReactNode }) {
  const u = await exigirUsuario();
  const ator = comoAtor(u);
  const obras = await listarObras(ator);
  return (
    <Casca
      nome={u.nome}
      perfil={u.administrador ? `${ROTULO_PERFIL[u.perfil]} · Administrador` : ROTULO_PERFIL[u.perfil]}
      orgao={u.orgaoNome}
      totalObras={obras.length}
      podeCriarObra={pode(ator, "obra.criar")}
      podeGerenciarUsuarios={pode(ator, "usuario.gerenciar")}
      podeVerAuditoria={pode(ator, "auditoria.ver")}
    >
      {children}
    </Casca>
  );
}
