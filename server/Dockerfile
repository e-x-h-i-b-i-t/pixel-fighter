FROM node:20-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package.json ./
RUN npm install --omit=dev

# Copy application source
COPY . .

# Create storage directory for the Q-table JSON
RUN mkdir -p /app/storage

EXPOSE 4000

CMD ["node", "index.js"]
