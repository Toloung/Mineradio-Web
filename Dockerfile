FROM node:20-alpine
WORKDIR /app

# Install deps
COPY package.json package-lock.json ./
RUN npm install --production

# Copy all files
COPY . .

# CloudBase Cloud Run needs port 80 or 3000
EXPOSE 3000

CMD ["node", "server/cloud-server.js"]
