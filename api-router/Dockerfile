FROM node:22-alpine

WORKDIR /app

# Installa solo le dipendenze di produzione (sfrutta la cache del layer)
COPY package.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 8000
CMD ["node", "src/server.js"]
