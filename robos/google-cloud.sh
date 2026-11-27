#!/usr/bin/env bash
# Instala os robôs de preços (SINAPI e SICRO) no Google Cloud, região São Paulo.
# Rodar no Cloud Shell, de dentro da pasta do repositório:  bash robos/google-cloud.sh
# Pode rodar de novo a qualquer momento: atualiza a imagem e mantém o agendamento.
set -euo pipefail

REGIAO=southamerica-east1
PROJETO=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJETO" ]; then echo "Escolha o projeto no alto do Cloud Shell (gcloud config set project ID) e rode de novo."; exit 1; fi
echo "Projeto: $PROJETO · Região: $REGIAO"

echo "1/5 Ativando os serviços..."
gcloud services enable run.googleapis.com cloudscheduler.googleapis.com secretmanager.googleapis.com \
  cloudbuild.googleapis.com artifactregistry.googleapis.com --quiet

echo "2/5 Endereço do banco..."
if ! gcloud secrets describe sinapi-database-url >/dev/null 2>&1; then
  read -r -s -p "Cole o endereço do banco (o mesmo do segredo SINAPI_DATABASE_URL do GitHub) e tecle Enter: " URL; echo
  printf %s "$URL" | gcloud secrets create sinapi-database-url --replication-policy=automatic --data-file=- --quiet
  unset URL
else
  echo "Já cadastrado. Para trocar: printf %s 'ENDERECO' | gcloud secrets versions add sinapi-database-url --data-file=-"
fi
NUMERO=$(gcloud projects describe "$PROJETO" --format='value(projectNumber)')
CONTA_EXEC="$NUMERO-compute@developer.gserviceaccount.com"
gcloud secrets add-iam-policy-binding sinapi-database-url --member="serviceAccount:$CONTA_EXEC" \
  --role=roles/secretmanager.secretAccessor --quiet >/dev/null

echo "3/5 Montando a imagem (leva alguns minutos na primeira vez)..."
IMAGEM="$REGIAO-docker.pkg.dev/$PROJETO/robos/precos:latest"
gcloud artifacts repositories describe robos --location=$REGIAO >/dev/null 2>&1 || \
  gcloud artifacts repositories create robos --repository-format=docker --location=$REGIAO --quiet
gcloud builds submit --region=$REGIAO --tag "$IMAGEM" --quiet .

echo "4/5 Criando os robôs..."
for ROBO in atualizar-sinapi atualizar-sicro; do
  gcloud run jobs deploy "$ROBO" --image "$IMAGEM" --region $REGIAO --args "$ROBO" \
    --set-secrets DATABASE_URL=sinapi-database-url:latest --set-env-vars SINAPI_UF=RJ,SICRO_UF=RJ \
    --memory 8Gi --cpu 2 --task-timeout 45m --max-retries 0 --quiet
done

echo "5/5 Agendando..."
gcloud iam service-accounts describe "robo-agenda@$PROJETO.iam.gserviceaccount.com" >/dev/null 2>&1 || \
  gcloud iam service-accounts create robo-agenda --display-name="Agenda dos robôs de preços" --quiet
AGENDA="robo-agenda@$PROJETO.iam.gserviceaccount.com"
gcloud projects add-iam-policy-binding "$PROJETO" --member="serviceAccount:$AGENDA" --role=roles/run.invoker --quiet >/dev/null
agendar() { # nome, horário cron, robô
  local URI="https://run.googleapis.com/v2/projects/$PROJETO/locations/$REGIAO/jobs/$3:run"
  if gcloud scheduler jobs describe "$1" --location=$REGIAO >/dev/null 2>&1; then
    gcloud scheduler jobs update http "$1" --location=$REGIAO --schedule="$2" --time-zone=America/Sao_Paulo --uri="$URI" --quiet >/dev/null
  else
    gcloud scheduler jobs create http "$1" --location=$REGIAO --schedule="$2" --time-zone=America/Sao_Paulo \
      --uri="$URI" --http-method=POST --oauth-service-account-email="$AGENDA" --quiet >/dev/null
  fi
}
agendar agenda-sinapi "30 6,12,18 8-28 * *" atualizar-sinapi
agendar agenda-sicro "0 7 * * *" atualizar-sicro

echo
echo "Pronto. SINAPI: 6h30, 12h30 e 18h30 do dia 8 ao 28. SICRO: todo dia às 7h (horário de Brasília)."
echo "Primeiro teste agora:  gcloud run jobs execute atualizar-sinapi --region $REGIAO --wait"
