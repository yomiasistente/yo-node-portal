FROM node:20-alpine

WORKDIR /app

# Install base packages, ffmpeg, and tools for yt-dlp
RUN apk add --no-cache \
    git \
    ffmpeg \
    python3 \
    py3-pip \
    pip3 \
    && pip3 install --no-cache-dir yt-dlp \
    && rm -rf /var/cache/apk/*

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
