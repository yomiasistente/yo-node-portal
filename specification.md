# yo-node-portal Specification

**Version:** 1.0  
**Date:** February 2026  
**Status:** Draft

---

## 1. Overview

### 1.1 Purpose
Web portal for managing and hosting Node.js applications and scripts deployed via Docker. Provides a unified interface to monitor, execute, configure, and manage multiple Node.js projects.

### 1.2 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Browser                          │
│              Vue.js 3 (CDN, no build)                     │
└─────────────────────────┬─────────────────────────────────┘
                          │ HTTP/HTTPS
┌─────────────────────────▼─────────────────────────────────┐
│              yo-node-portal Container                      │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  - Express Server (API + Static files)              │  │
│  │  - Docker SDK (container management)                │  │
│  │  - File Manager (JSON config editing)              │  │
│  │  - Process Manager (PM2-style operations)          │  │
│  │  - Log Aggregator                                   │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────┬─────────────────────────────────┘
                          │
┌─────────────────────────▼─────────────────────────────────┐
│              Docker Daemon                                 │
│  ┌───────────────────────┐  ┌───────────────────────┐   │
│  │  yo-node-portal      │  │  Managed Containers    │   │
│  │  (itself)            │  │  (your Node.js apps)  │   │
│  └───────────────────────┘  └───────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 Technology Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js + Express |
| Frontend | Vue.js 3 (CDN, no build) |
| Container Runtime | Docker SDK for Node.js |
| File Management | fs/promises (local configs) |
| Database | SQLite (optional, for logs/history) |
| Terminal | xterm.js (optional, for terminal access) |

---

## 2. Functional Requirements

### 2.1 Application Registry

| ID | Description | Priority |
|----|-------------|----------|
| FR-AR-01 | Auto-discover Node.js applications via `package.json` | Must Have |
| FR-AR-02 | Parse scripts section from `package.json` | Must Have |
| FR-AR-03 | Extract metadata (name, description, author) from `package.json` | Must Have |
| FR-AR-04 | Manual add/remove applications | Could Have |
| FR-AR-05 | Application categories/tags | Could Have |

### 2.2 Application Management

| ID | Description | Priority |
|----|-------------|----------|
| FR-AM-01 | Execute npm scripts from package.json | Must Have |
| FR-AM-02 | Start/stop Node.js processes | Must Have |
| FR-AM-03 | View running processes status | Must Have |
| FR-AM-04 | Process health monitoring | Must Have |
| FR-AM-05 | Restart applications | Must Have |

### 2.3 Execution & Logs

| ID | Description | Priority |
|----|-------------|----------|
| FR-EL-01 | Execute script and capture output | Must Have |
| FR-EL-02 | Real-time log streaming (WebSocket) | Must Have |
| FR-EL-03 | Execution history | Could Have |
| FR-EL-04 | Log file viewer | Could Have |
| FR-EL-05 | Download logs | Could Have |

### 2.4 Configuration Editor

| ID | Description | Priority |
|----|-------------|----------|
| FR-CE-01 | Read JSON config files | Must Have |
| FR-CE-02 | Edit JSON config with validation | Must Have |
| FR-CE-03 | Syntax highlighting | Should Have |
| FR-CE-04 | JSON schema validation | Could Have |
| FR-CE-05 | Config file backup/restore | Could Have |

### 2.5 Dashboard

| ID | Description | Priority |
|----|-------------|----------|
| FR-DB-01 | Tile view of all applications | Must Have |
| FR-DB-02 | Status indicators (running/stopped/error) | Must Have |
| FR-DB-03 | Quick actions (start/stop/restart) | Must Have |
| FR-DB-04 | Resource usage stats (CPU, Memory) | Could Have |
| FR-DB-05 | System health overview | Could Have |

---

## 3. Application Structure

### 3.1 Discovered Applications

Each managed application should have a structure like:

```
apps/
├── my-wol-app/
│   ├── package.json          # Source of truth
│   ├── src/
│   ├── data/
│   └── .env                  # Environment variables
├── my-script-collection/
│   ├── package.json
│   └── scripts/
└── api-gateway/
    ├── package.json
    └── ...
```

### 3.2 Package.json Schema

```json
{
  "name": "my-app",
  "description": "My Node.js application",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "test": "jest",
    "build": "webpack"
  },
  "portal": {
    "enabled": true,
    "category": "api",
    "port": 3000,
    "healthCheck": "/health"
  }
}
```

---

## 4. API Endpoints

### 4.1 Applications

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/apps` | List all applications |
| GET | `/api/apps/:id` | Get application details |
| POST | `/api/apps/:id/script/:script` | Execute npm script |
| POST | `/api/apps/:id/start` | Start application |
| POST | `/api/apps/:id/stop` | Stop application |
| POST | `/api/apps/:id/restart` | Restart application |
| GET | `/api/apps/:id/status` | Get running status |

### 4.2 Logs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/apps/:id/logs` | Get recent logs |
| GET | `/api/apps/:id/logs/stream` | WebSocket stream |
| GET | `/api/apps/:id/logs/download` | Download log file |

### 4.3 Configuration

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/apps/:id/config` | List config files |
| GET | `/api/apps/:id/config/:file` | Read config file |
| PUT | `/api/apps/:id/config/:file` | Write config file |

### 4.4 System

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Portal health check |
| GET | `/api/system/stats` | System resources |

---

## 5. UI Design

### 5.1 Navigation Structure

```
┌─────────────────────────────────────────────────────────────┐
│  🌙 yo-node-portal                            [⚙️ Admin] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─ Dashboard ───┐  ┌─ Aplicaciones ───┐  ┌─ Sistema ───┐  │
│  │    📊        │  │    📦            │  │    ⚙️       │  │
│  │  ACTIVO      │  │   INACTIVO       │  │   INACTIVO  │  │
│  └───────────────┘  └───────────────────┘  └──────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Application Tile

```
┌─────────────────────────────────────────────────────────────┐
│  ┌─ my-wol-app ───────────────────┐  🟢 Running (2d 5h)   │
│  │                                │                       │
│  │  📦 API Service                │  📊 CPU: 12%           │
│  │  v1.2.0                       │  💾 MEM: 256MB         │
│  │                                │                       │
│  │  🚀 start    [▶️] [⏸️] [🔄]   │  📝 Logs     [⚙️]    │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Script Actions

```
┌─────────────────────────────────────────────────────────────┐
│  🚀 Scripts Disponibles                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ [▶️ start]     Iniciar servidor (node src/server) │    │
│  │ [▶️ dev]       Modo desarrollo (nodemon)          │    │
│  │ [▶️ test]      Ejecutar tests                     │    │
│  │ [▶️ build]     Compilar producción                │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 5.4 Log Viewer

```
┌─────────────────────────────────────────────────────────────┐
│  📝 my-wol-app - Logs                             [⬇️] [🗑️] │
├─────────────────────────────────────────────────────────────┤
│  2026-02-05 10:15:32 [INFO] Server started on port 3000    │
│  2026-02-05 10:15:33 [INFO] Connected to database         │
│  2026-02-05 10:16:01 [INFO] New request: GET /api/devices │
│  2026-02-05 10:16:02 [INFO] Response: 200 OK (45ms)        │
│  2026-02-05 10:18:45 [WARN] Slow query detected (>100ms)  │
│  2026-02-05 10:20:11 [ERROR] Connection timeout           │
└─────────────────────────────────────────────────────────────┘
```

### 5.5 Config Editor

```
┌─────────────────────────────────────────────────────────────┐
│  ⚙️ config.json - my-wol-app                      [💾] [✕] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  {                                                         │
│    "port": 3000,          │  ← Cursor here                 │
│    "database": {                                           │
│      "host": "localhost",                                  │
│      "port": 5432                                          │
│    }                                                        │
│  }                                                         │
│                                                             │
│  ✅ Sintaxis válida                                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Implementation Details

### 6.1 Process Management

#### Option A: PM2-style (recommended)
- Use PM2 inside each application container
- Portal communicates via PM2 CLI or API

#### Option B: Direct process spawning
- Spawn processes directly from Node.js
- Manage lifecycle with child_process module
- Less isolated, simpler setup

#### Option C: Docker Container Management
- Each app runs in its own container
- Portal uses Docker SDK to manage
- Best isolation, more complex

**Recommendation:** Option C with Docker SDK for production-grade isolation.

### 6.2 Log Streaming

```javascript
// WebSocket endpoint for log streaming
app.ws('/api/apps/:id/logs/stream', (ws, req) => {
  const { exec } = require('child_process');
  const proc = exec(`tail -f ${appPath}/logs/*.log`);
  
  proc.stdout.on('data', (data) => {
    ws.send(data);
  });
  
  ws.on('close', () => {
    proc.kill();
  });
});
```

### 6.3 Configuration Editing

```javascript
// Safe JSON write with backup
async function updateConfig(filePath, newContent) {
  // Create backup
  await fs.copyFile(filePath, `${filePath}.backup`);
  
  // Validate JSON
  JSON.parse(newContent);
  
  // Write new content
  await fs.writeFile(filePath, newContent);
}
```

---

## 7. Docker Configuration

### 7.1 Dockerfile

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --production

# Copy app
COPY . .

# Create apps volume mount point
RUN mkdir -p /apps /data/logs && chmod 777 /data/logs

# Install Docker CLI (for container management)
RUN apk add --no-cache docker-cli

EXPOSE 3000

CMD ["node", "src/server.js"]
```

### 7.2 docker-compose.yml

```yaml
version: '3.8'

services:
  node-portal:
    build: .
    container_name: yo-node-portal
    ports:
      - "3000:3000"
    volumes:
      - ./apps:/app/apps:ro
      - ./data:/app/data
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - PORT=3000
      - APPS_PATH=/app/apps
    restart: unless-stopped
```

---

## 8. Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `APPS_PATH` | `./apps` | Path to managed applications |
| `DOCKER_SOCKET` | `/var/run/docker.sock` | Docker socket path |
| `LOG_RETENTION` | 7 | Days to keep logs |

---

## 9. Security Considerations

- **Authentication**: Basic auth or JWT (configurable)
- **Authorization**: Role-based access (admin/user/readonly)
- **Input Validation**: Sanitize all inputs
- **File Access**: Restrict to allowed directories
- **Script Execution**: Whitelist allowed npm scripts
- **Docker Security**: Non-root container user

---

## 10. Future Enhancements (Nice to Have)

- [ ] Terminal access (xterm.js)
- [ ] Git integration (pull/deploy)
- [ ] Multiple environments (dev/staging/prod)
- [ ] Notifications (email/Slack)
- [ ] Metrics dashboard (CPU, Memory, Network)
- [ ] Backup/restore apps
- [ ] Plugin system for custom actions
- [ ] Multi-user support
- [ ] Audit logging
- [ ] Docker Compose management

---

## 11. Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Feb 2026 | Initial specification |

---

*This document serves as the foundation for yo-node-portal development.*
