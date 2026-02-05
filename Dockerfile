FROM node:20-alpine

WORKDIR /app

# Install git for git clone deployments
RUN apk add --no-cache git

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --production

# Copy application
COPY src/ ./src/

# Create directories
RUN mkdir -p apps data/icons data/logs && chmod 777 apps data

EXPOSE 3000

CMD ["node", "src/server.js"]
