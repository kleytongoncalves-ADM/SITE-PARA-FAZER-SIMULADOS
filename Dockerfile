# Imagem dos robôs de preços (SINAPI e SICRO) para rodar fora do GitHub, por exemplo no
# Google Cloud Run em São Paulo. Não é usada pelo site, que é publicado pela Netlify.
FROM node:22-slim
WORKDIR /app
ENV NODE_OPTIONS=--max-old-space-size=6144 LANG=C.UTF-8 LC_ALL=C.UTF-8
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY tsconfig.json ./
COPY scripts ./scripts
COPY src ./src
# Qual robô roda é escolhido pelo argumento: atualizar-sinapi ou atualizar-sicro.
ENTRYPOINT ["npm", "run", "--silent"]
CMD ["atualizar-sinapi"]
