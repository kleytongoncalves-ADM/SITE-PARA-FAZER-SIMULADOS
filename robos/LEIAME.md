# Robôs de preços fora do GitHub

O site da Caixa recusa downloads vindos dos servidores do GitHub (resposta 429). Os mesmos robôs
podem rodar no Google Cloud, região São Paulo, com a imagem do `Dockerfile` da raiz.

1. Crie a conta em https://cloud.google.com (pessoa física, CPF) e um projeto.
2. Abra o Cloud Shell (ícone `>_` no alto do console) e rode:

   ```bash
   git clone https://github.com/kleytongoncalves-ADM/civiobras.git && cd civiobras
   bash robos/google-cloud.sh
   ```

   Se o repositório for privado, o git pede usuário e senha: a senha é um token do GitHub
   (Settings > Developer settings > Personal access tokens > Fine-grained, só leitura deste repositório).
3. O script pede o endereço do banco (o mesmo do segredo `SINAPI_DATABASE_URL`), cria os robôs
   `atualizar-sinapi` e `atualizar-sicro` no Cloud Run e agenda:
   SINAPI às 6h30, 12h30 e 18h30 do dia 8 ao 28; SICRO todo dia às 7h.
4. Primeiro teste: `gcloud run jobs execute atualizar-sinapi --region southamerica-east1 --wait`

Para atualizar depois de mudanças no código: `git pull && bash robos/google-cloud.sh`.
