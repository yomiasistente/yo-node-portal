# yo-node-portal Specification

**Version:** 1.2  
**Date:** February 2026  
**Status:** Draft

---

## 1. Overview

### 1.1 Purpose
Web portal for managing and hosting Node.js applications and scripts within the same container as the portal itself. Provides a unified interface to discover, deploy, execute, configure, and monitor multiple Node.js projects.

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
│  │  - Process Manager (child_process)                  │  │
│  │  - File Manager (JSON config editing)              │  │
│  │  - Git Client (clone repositories)                 │  │
│  │  - ZIP Handler (extract uploaded apps)             │  │
│  │  - Log Aggregator (WebSocket streaming)            │  │
│  └─────────────────────────────────────────────────────┘  │
│                        │                                   │
│  ┌─────────────────────▼────────────────────────────────┐  │
│  │              apps/ Directory                         │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │  │
│  │  │ my-wol-app  │  │ my-scripts  │  │ api-gateway │  │  │
│  │  │ (cloned)    │  │ (zip)       │  │ (manual)    │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 Technology Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js + Express |
| Frontend | Vue.js 3 (CDN, no build) |
| Process Management | child_process module |
| Git Integration | simple-git or child_process git CLI |
| ZIP Handling | adm-zip or yauzl |
| Database | SQLite (optional, for deployment history/logs) |
| Logging | Winston + WebSocket |

---

## 2. Functional Requirements

### 2.1 Application Registry

| ID | Description | Priority |
|----|-------------|----------|
| FR-AR-01 | Auto-discover Node.js applications via `package.json` | Must Have |
| FR-AR-02 | Parse scripts section from `package.json` | Must Have |
| FR-AR-03 | Extract metadata (name, description, author) from `package.json` | Must Have |
| FR-AR-04 | Override metadata (title, description, etc.) from app config | Must Have |
| FR-AR-05 | Configure which scripts are visible/executable | Must Have |
| FR-AR-06 | Hide sensitive scripts (postinstall, etc.) | Must Have |
| FR-AR-07 | Upload and assign custom icons to applications | Must Have |
| FR-AR-08 | Manual add/remove applications | Could Have |
| FR-AR-09 | Application categories/tags | Could Have |

### 2.2 Deployment

| ID | Description | Priority |
|----|-------------|----------|
| FR-DP-01 | Deploy by cloning Git repository | Must Have |
| FR-DP-02 | Deploy by uploading ZIP file | Must Have |
| FR-DP-03 | Validate package.json after deployment | Must Have |
| FR-DP-04 | Auto-install dependencies after deployment | Must Have |
| FR-DP-05 | Delete applications | Must Have |
| FR-DP-06 | View deployment history | Could Have |

### 2.3 Application Management

| ID | Description | Priority |
|----|-------------|----------|
| FR-AM-01 | Execute npm scripts from package.json | Must Have |
| FR-AM-02 | Start/stop Node.js processes | Must Have |
| FR-AM-03 | View running processes status | Must Have |
| FR-AM-04 | Process health monitoring | Must Have |
| FR-AM-05 | Restart applications/scripts | Must Have |
| FR-AM-06 | View resource usage (CPU, Memory) | Should Have |

### 2.4 Execution & Logs

| ID | Description | Priority |
|----|-------------|----------|
| FR-EL-01 | Execute script and capture output | Must Have |
| FR-EL-02 | Real-time log streaming (WebSocket) | Must Have |
| FR-EL-03 | Execution history | Could Have |
| FR-EL-04 | Per-app log files | Could Have |
| FR-EL-05 | Download logs | Could Have |

### 2.5 Configuration Editor

| ID | Description | Priority |
|----|-------------|----------|
| FR-CE-01 | Read JSON config files | Must Have |
| FR-CE-02 | Edit JSON config with validation | Must Have |
| FR-CE-03 | Syntax highlighting | Should Have |
| FR-CE-04 | JSON schema validation | Could Have |
| FR-CE-05 | Config file backup/restore | Could Have |

### 2.6 Dashboard

| ID | Description | Priority |
|----|-------------|----------|
| FR-DB-01 | Tile view of all applications | Must Have |
| FR-DB-02 | Status indicators (running/stopped/error) | Must Have |
| FR-DB-03 | Quick actions (start/stop/restart) | Must Have |
| FR-DB-04 | Resource usage stats (CPU, Memory) | Could Have |
| FR-DB-05 | System health overview | Could Have |

---

## 3. Application Structure

### 3.1 Apps Directory

```
apps/
├── my-wol-app/                  # Deployed application
│   ├── package.json             # Source of truth
│   ├── src/
│   ├── data/
│   ├── .env                     # Environment variables
│   └── logs/                    # App-specific logs
├── my-scripts/
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
    "title": "My App",                    // Override display title
    "description": "Custom description",  // Override description
    "category": "api",
    "icon": null,                         // Icon filename (null = use default)
    "hiddenScripts": ["postinstall", "prepublish"],
    "scripts": {
      "start": { 
        "label": "Iniciar servidor", 
        "description": "Inicia el servidor en producción",
        "hidden": false
      },
      "dev": { 
        "label": "Desarrollo", 
        "description": "Modo desarrollo con nodemon",
        "hidden": false
      },
      "test": { 
        "label": "Tests", 
        "description": "Ejecuta los tests unitarios",
        "hidden": false
      }
    }
  }
}
```

### 3.3 App Configuration Schema (`.portal-config.json`)

Each application stores its configuration in `.portal-config.json` alongside `package.json`:

```json
{
  "id": "my-wol-app",
  "title": "My WOL Manager",
  "description": "Custom application description",
  "icon": "custom-icon.png",
  "category": "api",
  "hiddenScripts": ["postinstall", "prepublish"],
  "customScripts": {
    "start": { 
      "label": "🚀 Iniciar Servidor", 
      "description": "Inicia el servidor en producción",
      "hidden": false
    },
    "dev": { 
      "label": "🔧 Desarrollo", 
      "description": "Modo desarrollo con nodemon",
      "hidden": false
    }
  },
  "deployedAt": "2026-02-05T22:00:00Z",
  "lastUpdated": "2026-02-05T22:00:00Z"
}
```

**Configuration Merge Rules:**
- If `.portal-config.json` exists, it overrides `package.json` values
- `customScripts` merge with package.json scripts (custom takes precedence)
- `hiddenScripts` applies on top of package.json

### 3.4 Portal Configuration (Global)

Portal-wide configuration stored at `data/portal-config.json`:

```json
{
  "general": {
    "title": "yo-node-portal",
    "theme": "light",
    "defaultIcon": "📦"
  },
  "icons": {
    "storagePath": "./data/icons",
    "maxSize": 102400,  // 100KB max
    "allowedTypes": ["image/png", "image/jpeg", "image/svg+xml"]
  },
  "deployment": {
    "defaultBranch": "main",
    "autoInstallDeps": true,
    "gitTimeout": 60000
  },
  "security": {
    "authEnabled": false,
    "allowedScripts": []  // Empty = allow all from config
  }
}
```

### 3.5 Icons Storage

```
data/
├── portal-config.json          // Global portal configuration
├── icons/                      // Uploaded icons storage
│   ├── my-wol-app.png
│   ├── my-scripts.svg
│   └── api-gateway.jpg
└── logs/                       // Global logs
    └── portal.log
```

**Icons Rules:**
- Icons uploaded by user stored in `data/icons/`
- Each app references icon by filename
- Default icon shown if none specified
- Supported formats: PNG, JPEG, SVG
- Maximum size: 100KB

---

## 4. API Endpoints

### 4.1 Applications

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/apps` | List all applications |
| GET | `/api/apps/:id` | Get application details |
| GET | `/api/apps/:id/package` | Get package.json content |
| POST | `/api/apps/:id/script/:script` | Execute npm script |
| POST | `/api/apps/:id/start` | Start application (long-running) |
| POST | `/api/apps/:id/stop` | Stop application |
| POST | `/api/apps/:id/restart` | Restart application |
| GET | `/api/apps/:id/status` | Get running status |
| DELETE | `/api/apps/:id` | Delete application |

### 4.2 Deployment

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/deploy/git` | Clone from Git repository |
| POST | `/api/deploy/zip` | Deploy from ZIP file upload |
| POST | `/api/deploy/manual` | Register existing directory |
| GET | `/api/deploy/history` | View deployment history |

#### Git Deploy Payload
```json
{
  "repoUrl": "https://github.com/user/repo.git",
  "branch": "main",
  "targetPath": "./apps/my-new-app",
  "installDeps": true
}
```

#### ZIP Deploy
- File upload via multipart/form-data
- Extracts to apps directory

### 4.3 Scripts Configuration

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/apps/:id/scripts` | Get list of visible scripts |
| PUT | `/api/apps/:id/scripts/:script` | Update script visibility/settings |

### 4.4 App Configuration

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/apps/:id/config` | Get app configuration (merged) |
| PUT | `/api/apps/:id/config` | Update app configuration (title, description, icon) |
| GET | `/api/apps/:id/icon` | Get app icon URL |
| PUT | `/api/apps/:id/icon` | Upload/change app icon |

#### App Config Payload
```json
{
  "title": "My Custom Title",
  "description": "My custom description",
  "category": "utilities",
  "icon": "custom-icon.png",
  "hiddenScripts": ["postinstall"],
  "customScripts": {
    "start": { "label": "🚀 Start", "hidden": false }
  }
}
```

### 4.5 Icons

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/icons` | List all uploaded icons |
| POST | `/api/icons` | Upload new icon |
| DELETE | `/api/icons/:filename` | Delete icon |
| GET | `/api/icons/:filename` | Serve icon file |

#### Upload Icon
- Endpoint: `POST /api/icons`
- Content-Type: `multipart/form-data`
- Body: `icon` (file field), `name` (optional filename)

---

### 4.6 Logs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/apps/:id/logs` | Get recent logs |
| GET | `/api/apps/:id/logs/stream` | WebSocket stream |
| GET | `/api/apps/:id/logs/download` | Download log file |

### 4.5 Configuration

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/apps/:id/config` | List config files |
| GET | `/api/apps/:id/config/:file` | Read config file |
| PUT | `/api/apps/:id/config/:file` | Write config file |

### 4.7 App Configuration

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/apps/:id/config` | Get merged app configuration |
| PUT | `/api/apps/:id/config` | Update app config (title, description, icon) |
| GET | `/api/apps/:id/icon` | Get app icon URL |

### 4.8 Icons

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/icons` | List uploaded icons |
| POST | `/api/icons` | Upload new icon (multipart/form-data) |
| DELETE | `/api/icons/:filename` | Delete icon |
| GET | `/api/icons/:filename` | Serve icon file |

### 4.9 System

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Portal health check |
| GET | `/api/system/stats` | System resources |
| GET | `/api/system/config` | Get portal configuration |
| PUT | `/api/system/config` | Update portal configuration |


## 5. UI Design

### 5.1 Navigation Structure

```
┌─────────────────────────────────────────────────────────────┐
│  🌙 yo-node-portal                            [⚙️ Admin] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─ Dashboard ───┐  ┌─ Aplicaciones ───┐  ┌─ Desplegar ─┐ │
│  │    📊        │  │    📦            │  │    🚀        │ │
│  │  ACTIVO      │  │   INACTIVO       │  │   ACTIVO     │ │
│  └───────────────┘  └───────────────────┘  └──────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Dashboard View

```
┌─────────────────────────────────────────────────────────────┐
│  🌙 yo-node-portal                               [+ Desplegar]│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📊 Resumen                                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 📦 Apps: 5  🟢 Running: 2  🔴 Stopped: 3          │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  📦 Aplicaciones                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ ☑️ │ my-wol-app        │ 🟢 Running   │ [⚙️]    │    │
│  │ ☑️ │ my-scripts        │ 🔴 Stopped   │ [⚙️]    │    │
│  │ ☑️ │ api-gateway       │ 🟡 Error      │ [⚙️]    │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Application Tile

```
┌─────────────────────────────────────────────────────────────┐
│  ┌─ my-wol-app ───────────────────┐  🟢 Running (2d 5h)   │
│  │  🖼️                           │                       │
│  │  My WOL Manager               │  📊 CPU: 12%           │
│  │  v1.2.0                      │  💾 MEM: 256MB         │
│  │                                │                       │
│  │  🚀 [▶️ start]  [▶️ dev]    │  📝 Logs     [⚙️]    │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 5.4 Deploy Modal

```
┌───────────────────────────────────────────────────────────────┐
│  🚀 Desplegar Nueva Aplicación                    [✕ Cerrar] │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─ Método de Despliegue ──────────────────────────────────┐  │
│  │ ○ Git Repository    ○ Subir ZIP    ○ Carpeta Existente  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─ Git Repository ────────────────────────────────────────┐  │
│  │ URL del repositorio *                                    │  │
│  │ ┌─────────────────────────────────────────────────────┐  │  │
│  │ └─────────────────────────────────────────────────────┘  │  │
│  │ Rama: [main           ]                                │  │
│  │ Carpeta destino: [my-app        ]                     │  │
│  │ ☐ Instalar dependencias automáticamente              │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─ Subir ZIP ────────────────────────────────────────────┐  │
│  │ ┌─────────────────────────────────────────────────────┐  │  │
│  │ │ Arrastra aquí o haz clic para seleccionar          │  │  │
│  │ └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                               │
│                                    [Cancelar]  [🚀 Desplegar] │
└───────────────────────────────────────────────────────────────┘
```

### 5.5 Log Viewer

```
┌─────────────────────────────────────────────────────────────┐
│  📝 my-wol-app - Logs                             [⬇️] [🗑️] │
├─────────────────────────────────────────────────────────────┤
│  2026-02-05 10:15:32 [INFO] Server started on port 3000    │
│  2026-02-05 10:15:33 [INFO] Connected to database         │
│  2026-02-05 10:16:01 [INFO] New request: GET /api/devices │
│  2026-02-05 10:16:02 [INFO] Response: 200 OK (45ms)      │
│  2026-02-05 10:18:45 [WARN] Slow query detected (>100ms) │
│  2026-02-05 10:20:11 [ERROR] Connection timeout          │
└─────────────────────────────────────────────────────────────┘
```

### 5.6 Config Editor

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

### 5.7 App Configuration

```
┌───────────────────────────────────────────────────────────────┐
│  ⚙️ Configurar Aplicación - my-wol-app             [✕ Cerrar] │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─ Icono ─────────────────────────────────────────────────┐  │
│  │                                                          │  │
│  │     ┌─────────────┐                                      │  │
│  │     │  🖼️        │    [📤 Subir icono]                 │  │
│  │     └─────────────┘                                     │  │
│  │                                                          │  │
│  │  Formatos: PNG, JPG, SVG (max 100KB)                   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─ Información General ───────────────────────────────────┐  │
│  │                                                          │  │
│  │  Título personalizado *                                   │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │ My WOL Manager                                      │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                          │  │
│  │  Descripción                                             │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │ Gestor de dispositivos Wake-on-LAN                   │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                          │  │
│  │  Categoría                                               │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │ utilities ▾                                         │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                          │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─ Scripts ───────────────────────────────────────────────┐  │
│  │                                                          │  │
│  │  Script       │ Visible │ Etiqueta                       │  │
│  │  ─────────────┼─────────┼─────────────────────────────── │  │
│  │  start       │ ☑      │ Iniciar servidor              │  │
│  │  dev         │ ☑      │ Modo desarrollo               │  │
│  │  test        │ ☑      │ Ejecutar tests                 │  │
│  │  build       │ ☐      │ Compilar producción           │  │
│  │  postinstall │ ☐      │ (interno)                     │  │
│  │                                                          │  │
│  │  [📤 Gestionar Scripts...]                             │  │
│  │                                                          │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                               │
│  [💾 Guardar]  [📄 Ver package.json completo]                │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### 5.8 Icons Gallery

```
┌───────────────────────────────────────────────────────────────┐
│  📤 Gestionar Iconos                                [✕ Cerrar] │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─ Subir Icono ──────────────────────────────────────────┐  │
│  │                                                          │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │ Arrastra aquí o haz clic para seleccionar          │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                          │  │
│  │  Formatos permitidos: PNG, JPG, SVG                    │  │
│  │  Tamaño máximo: 100KB                                   │  │
│  │                                                          │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                               │
│  📦 Iconos Disponibles                                       │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ [🖼️] my-wol-app.png        [🗑️] [📎]               │    │
│  │ [🖼️] my-scripts.svg         [🗑️] [📎]               │    │
│  │ [🖼️] api-gateway.jpg        [🗑️] [📎]               │    │
│  │ [🖼️] default-app.png        [🗑️] [📎]               │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  [📤 Subir más iconos...]                                    │
│                                                               │
└───────────────────────────────────────────────────────────────┘

## 6. Implementation Details

### 6.1 Process Management

Processes run in the SAME container using Node.js `child_process`:

```javascript
// Execute script and capture output
async function executeScript(appPath, scriptName) {
  const { spawn } = require('child_process');
  
  return new Promise((resolve, reject) => {
    const proc = spawn('npm', ['run', scriptName], {
      cwd: appPath,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    let output = '';
    proc.stdout.on('data', (data) => {
      output += data.toString();
      // Emit to WebSocket for real-time viewing
    });
    
    proc.stderr.on('data', (data) => {
      output += data.toString();
    });
    
    proc.on('close', (code) => {
      resolve({ code, output });
    });
  });
}

// Long-running process management
const runningProcesses = new Map();

async function startApp(appPath) {
  const proc = spawn('npm', ['run', 'start'], {
    cwd: appPath,
    stdio: 'pipe',
    detached: true
  });
  
  const pid = proc.pid;
  runningProcesses.set(pid, { proc, appPath, startedAt: new Date() });
  
  proc.stdout.on('data', (data) => {
    // Emit to WebSocket
  });
  
  return pid;
}

function stopApp(pid) {
  const procInfo = runningProcesses.get(pid);
  if (procInfo) {
    process.kill(-pid);  // Kill process tree
    runningProcesses.delete(pid);
  }
}
```

### 6.2 Git Deployment

```javascript
const simpleGit = require('simple-git');

async function deployFromGit(repoUrl, branch, targetPath) {
  const git = simpleGit();
  
  // Clone repository
  await git.clone(repoUrl, targetPath);
  
  // Checkout specific branch
  const repo = simpleGit(targetPath);
  await repo.checkout(branch);
  
  // Install dependencies
  const { exec } = require('child_process');
  await new Promise((resolve, reject) => {
    const proc = exec('npm install', { cwd: targetPath });
    proc.on('close', resolve);
    proc.on('error', reject);
  });
  
  return { success: true, path: targetPath };
}
```

### 6.3 ZIP Deployment

```javascript
const admZip = require('adm-zip');
const fs = require('fs');
const path = require('path');

async function deployFromZip(zipBuffer, targetPath) {
  const zip = new admZip(zipBuffer);
  
  // Extract to target directory
  zip.extractAllTo(targetPath, true);
  
  // Validate package.json exists
  const packagePath = path.join(targetPath, 'package.json');
  if (!fs.existsSync(packagePath)) {
    throw new Error('Invalid ZIP: package.json not found');
  }
  
  return { success: true, path: targetPath };
}
```

### 6.4 Log Streaming

```javascript
// In-memory log buffer per app
const appLogs = new Map();

// WebSocket endpoint for log streaming
app.ws('/api/apps/:id/logs/stream', (ws, req) => {
  const appId = req.params.id;
  
  // Send recent logs
  const logs = appLogs.get(appId) || [];
  ws.send(JSON.stringify({ type: 'history', logs }));
  
  // Subscribe to new logs
  const subscription = subscribeToLogs(appId, (log) => {
    ws.send(JSON.stringify({ type: 'log', data: log }));
  });
  
  ws.on('close', () => {
    unsubscribeFromLogs(appId, subscription);
  });
});
```

### 6.5 Script Configuration

```javascript
// Merge package.json scripts with portal configuration
function getVisibleScripts(appPath) {
  const packageJson = require(path.join(appPath, 'package.json'));
  const portalConfig = loadOrCreateConfig(path.join(appPath, '.portal-config.json'));
  
  const allScripts = Object.keys(packageJson.scripts || {});
  const hiddenScripts = portalConfig.hiddenScripts || [];
  
  return allScripts
    .filter(script => !hiddenScripts.includes(script))
    .map(script => ({
      name: script,
      command: packageJson.scripts[script],
      label: portalConfig.customScripts?.[script]?.label || script,
      description: portalConfig.customScripts?.[script]?.description || '',
      executable: true
    }));
}

function updateScriptConfig(appPath, scriptName, config) {
  const configPath = path.join(appPath, '.portal-config.json');
  const config = loadOrCreateConfig(configPath);
  
  if (!config.customScripts) config.customScripts = {};
  config.customScripts[scriptName] = config;
  
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}
```

## 7. Docker Configuration

### 7.1 Dockerfile

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install git for git clone deployments
RUN apk add --no-cache git

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --production

# Copy application
COPY . .

# Create apps volume mount point
RUN mkdir -p /app/apps /app/data/logs && chmod 777 /app/data/logs

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
      - ./apps:/app/apps
      - ./data:/app/data
    environment:
      - PORT=3000
      - APPS_PATH=/app/apps
      - LOGS_PATH=/app/data/logs
    restart: unless-stopped
    tty: true
    stdin_open: true
```

---

## 8. Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `APPS_PATH` | `./apps` | Path to managed applications |
| `LOGS_PATH` | `./data/logs` | Path to log files |
| `MAX_LOG_LINES` | 1000 | Maximum lines to keep in memory |
| `GIT_TIMEOUT` | 60000 | Git operations timeout (ms) |

---

## 9. Security Considerations

- **Script Whitelisting**: Only allow specific scripts to be executed
- **Path Traversal**: Sanitize all file paths
- **Input Validation**: Validate Git URLs, ZIP content
- **File Access**: Restrict to apps directory
- **Process Isolation**: Use chroot or containers for better isolation
- **No Root**: Run processes as non-root user
- **Authentication**: Basic auth or JWT (configurable)

---

## 10. Future Enhancements (Nice to Have)

- [ ] Terminal access (xterm.js)
- [ ] Environment management (dev/staging/prod)
- [ ] Notifications (email/Slack)
- [ ] Metrics dashboard (CPU, Memory, Network)
- [ ] Backup/restore apps
- [ ] Plugin system for custom actions
- [ ] Multi-user support with roles
- [ ] Audit logging
- [ ] Docker Compose management

---

## 11. Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Feb 2026 | Initial specification |
| 1.1 | Feb 2026 | Apps run in same container; configurable scripts; git/zip deployment |
| 1.2 | Feb 2026 | App metadata override (title, description); custom icons; icons gallery; configuration storage |

---

## 12. Configuration Storage

### 12.1 Global Portal Configuration

Location: `data/portal-config.json`

```json
{
  "general": {
    "title": "yo-node-portal",
    "theme": "light",
    "defaultIcon": "package"
  },
  "icons": {
    "storagePath": "./data/icons",
    "maxSize": 102400,
    "allowedTypes": ["image/png", "image/jpeg", "image/svg+xml"]
  },
  "deployment": {
    "defaultBranch": "main",
    "autoInstallDeps": true,
    "gitTimeout": 60000
  },
  "security": {
    "authEnabled": false,
    "allowedScripts": []
  }
}
```

### 12.2 Application Configuration

Location: `{app-path}/.portal-config.json`

```json
{
  "id": "my-wol-app",
  "title": "My WOL Manager",
  "description": "Custom application description",
  "icon": "custom-icon.png",
  "category": "api",
  "hiddenScripts": ["postinstall", "prepublish"],
  "customScripts": {
    "start": {
      "label": "Start Server",
      "description": "Starts the production server",
      "hidden": false
    }
  },
  "deployedAt": "2026-02-05T22:00:00Z",
  "lastUpdated": "2026-02-05T22:30:00Z"
}
```

### 12.3 Icons Storage

Location: `data/icons/{filename}`

```
data/
├── portal-config.json      # Global portal configuration
├── icons/                  # Uploaded icons
│   ├── my-wol-app.png
│   ├── my-scripts.svg
│   ├── api-gateway.jpg
│   └── default.png
└── logs/
    └── portal.log
```

**Icons Rules:**
- Uploaded icons stored in `data/icons/`
- Referenced by filename in app config
- Default icon used if none specified
- Supported: PNG, JPEG, SVG (max 100KB)

---

*This document serves as the foundation for yo-node-portal development.*
