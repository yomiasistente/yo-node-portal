const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const { exec, spawn } = require('child_process');

const PORT = process.env.PORT || 3000;
const APPS_PATH = process.env.APPS_PATH || path.join(__dirname, '..', 'apps');
const DATA_PATH = process.env.DATA_PATH || path.join(__dirname, '..', 'data');
const ICONS_PATH = process.env.ICONS_PATH || path.join(DATA_PATH, 'icons');
const LOGS_PATH = process.env.LOGS_PATH || path.join(DATA_PATH, 'logs');
const RUNNING_STATE_FILE = process.env.RUNNING_STATE_FILE || path.join(DATA_PATH, 'running.json');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Track running processes: Map<"appId:scriptName", { proc, startTime }>
const runningProcesses = new Map();

// Persist running state to disk
function saveRunningState() {
  try {
    const state = {};
    for (const [key, value] of runningProcesses) {
      state[key] = {
        startTime: value.startTime.toISOString(),
        pid: value.proc.pid
      };
    }
    fs.writeFileSync(RUNNING_STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('Error saving running state:', e.message);
  }
}

function loadRunningState() {
  try {
    if (fs.existsSync(RUNNING_STATE_FILE)) {
      const state = JSON.parse(fs.readFileSync(RUNNING_STATE_FILE, 'utf8'));
      for (const [key, value] of Object.entries(state)) {
        // Just load the state, processes will need to be restarted manually
        console.log(`[State] Loaded running process: ${key} (was PID ${value.pid})`);
      }
      // Clear the file since we can't track actual processes
      fs.unlinkSync(RUNNING_STATE_FILE);
    }
  } catch (e) {
    console.error('Error loading running state:', e.message);
  }
}

// Load persisted state on startup
loadRunningState();

// Ensure directories exist
[APPS_PATH, DATA_PATH, ICONS_PATH, LOGS_PATH].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Serve icons
app.use('/api/icons', express.static(ICONS_PATH));

// ============ API Routes ============

// Apps
app.get('/api/apps', (req, res) => {
  const apps = [];
  
  if (fs.existsSync(APPS_PATH)) {
    const entries = fs.readdirSync(APPS_PATH, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const packagePath = path.join(APPS_PATH, entry.name, 'package.json');
        const configPath = path.join(APPS_PATH, entry.name, '.portal-config.json');
        
        if (fs.existsSync(packagePath)) {
          try {
            const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
            const configJson = fs.existsSync(configPath) 
              ? JSON.parse(fs.readFileSync(configPath, 'utf8'))
              : {};
            
            // Get running scripts for this app
            const runningScripts = [];
            for (const [key] of runningProcesses) {
              if (key.startsWith(`${entry.name}:`)) {
                const scriptName = key.split(':')[1];
                runningScripts.push(scriptName);
              }
            }
            
            apps.push({
              id: entry.name,
              name: configJson.title || packageJson.name || entry.name,
              description: configJson.description || packageJson.description || '',
              version: packageJson.version || '',
              icon: configJson.icon || null,
              category: configJson.category || 'general',
              scripts: getScripts(entry.name),
              runningScripts,
              deployedAt: configJson.deployedAt || null,
              lastUpdated: configJson.lastUpdated || null
            });
          } catch (e) {
            console.error(`Error reading ${entry.name}:`, e.message);
          }
        }
      }
    }
  }
  
  res.json({ success: true, data: apps });
});

app.get('/api/apps/:id', (req, res) => {
  const { id } = req.params;
  const appPath = path.join(APPS_PATH, id);
  const packagePath = path.join(appPath, 'package.json');
  const configPath = path.join(appPath, '.portal-config.json');
  
  if (!fs.existsSync(packagePath)) {
    return res.status(404).json({ success: false, error: 'App not found' });
  }
  
  try {
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const configJson = fs.existsSync(configPath)
      ? JSON.parse(fs.readFileSync(configPath, 'utf8'))
      : {};
    
    res.json({
      success: true,
      data: {
        id,
        name: configJson.title || packageJson.name,
        description: configJson.description || packageJson.description || '',
        version: packageJson.version,
        icon: configJson.icon,
        category: configJson.category,
        scripts: getScripts(id),
        hiddenScripts: configJson.hiddenScripts || [],
        deployedAt: configJson.deployedAt,
        lastUpdated: configJson.lastUpdated,
        packageJson
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.put('/api/apps/:id/config', (req, res) => {
  const { id } = req.params;
  const { title, description, icon, category, hiddenScripts, customScripts } = req.body;
  const appPath = path.join(APPS_PATH, id);
  const configPath = path.join(appPath, '.portal-config.json');
  
  if (!fs.existsSync(appPath)) {
    return res.status(404).json({ success: false, error: 'App not found' });
  }
  
  try {
    const config = fs.existsSync(configPath)
      ? JSON.parse(fs.readFileSync(configPath, 'utf8'))
      : {};
    
    if (title !== undefined) config.title = title;
    if (description !== undefined) config.description = description;
    if (icon !== undefined) config.icon = icon;
    if (category !== undefined) config.category = category;
    if (hiddenScripts !== undefined) config.hiddenScripts = hiddenScripts;
    if (customScripts !== undefined) config.customScripts = customScripts;
    config.lastUpdated = new Date().toISOString();
    
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    res.json({ success: true, data: config });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Delete app
app.delete('/api/apps/:id', (req, res) => {
  const { id } = req.params;
  const appPath = path.join(APPS_PATH, id);
  
  if (!fs.existsSync(appPath)) {
    return res.status(404).json({ success: false, error: 'App not found' });
  }
  
  try {
    // Delete app directory recursively
    const { execSync } = require('child_process');
    execSync(`rm -rf "${appPath}"`);
    
    // Also clean up logs from buffer
    logBuffer.delete(id);
    
    res.json({ success: true, data: { id } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Scripts
function getScripts(appId) {
  const appPath = path.join(APPS_PATH, appId);
  const packagePath = path.join(appPath, 'package.json');
  const configPath = path.join(appPath, '.portal-config.json');
  
  if (!fs.existsSync(packagePath)) return [];
  
  try {
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const configJson = fs.existsSync(configPath)
      ? JSON.parse(fs.readFileSync(configPath, 'utf8'))
      : {};
    
    const hiddenScripts = configJson.hiddenScripts || [];
    const customScripts = configJson.customScripts || {};
    
    const scripts = [];
    for (const [name, command] of Object.entries(packageJson.scripts || {})) {
      if (!hiddenScripts.includes(name)) {
        scripts.push({
          name,
          command,
          label: customScripts[name]?.label || name,
          description: customScripts[name]?.description || '',
          executable: true
        });
      }
    }
    return scripts;
  } catch (e) {
    return [];
  }
}

app.get('/api/apps/:id/scripts', (req, res) => {
  res.json({ success: true, data: getScripts(req.params.id) });
});

app.post('/api/apps/:id/script/:script', (req, res) => {
  const { id, script } = req.params;
  const appPath = path.join(APPS_PATH, id);
  const key = `${id}:${script}`;
  
  // Check if already running
  if (runningProcesses.has(key)) {
    return res.status(400).json({ 
      success: false, 
      error: `Script "${script}" ya esta en ejecucion` 
    });
  }
  
  // Execute script
  const proc = spawn('npm', ['run', script], {
    cwd: appPath,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env }
  });
  
  // Track the process
  runningProcesses.set(key, { proc, startTime: new Date() });
  
  let output = '';
  proc.stdout.on('data', (data) => {
    const text = data.toString();
    output += text;
    broadcastLog(id, { type: 'stdout', data: text });
  });
  
  proc.stderr.on('data', (data) => {
    const text = data.toString();
    output += text;
    broadcastLog(id, { type: 'stderr', data: text });
  });
  
  proc.on('close', (code) => {
    runningProcesses.delete(key);
    broadcastLog(id, { type: 'exit', data: code.toString() });
    res.json({ success: true, data: { code, output } });
  });
  
  proc.on('error', (err) => {
    runningProcesses.delete(key);
    res.status(500).json({ success: false, error: err.message });
  });
});

// Kill running process
app.post('/api/apps/:id/kill', (req, res) => {
  const { id } = req.params;
  const { script } = req.body;
  
  if (!script) {
    return res.status(400).json({ success: false, error: 'Script name required' });
  }
  
  const key = `${id}:${script}`;
  
  if (!runningProcesses.has(key)) {
    return res.status(404).json({ 
      success: false, 
      error: `No hay proceso en ejecucion para "${script}"` 
    });
  }
  
  try {
    const { proc } = runningProcesses.get(key);
    
    // Kill the process tree
    try {
      process.kill(-proc.pid, 'SIGKILL');
    } catch (e) {
      // Process might already be dead
    }
    
    runningProcesses.delete(key);
    broadcastLog(id, { type: 'info', data: `Proceso "${script}" matado` });
    
    res.json({ success: true, data: { key } });
  } catch (e) {
    runningProcesses.delete(key);
    res.status(500).json({ success: false, error: e.message });
  }
});

// Get running processes status
app.get('/api/apps/:id/running', (req, res) => {
  const { id } = req.params;
  const running = [];
  
  for (const [key, value] of runningProcesses) {
    if (key.startsWith(`${id}:`)) {
      const script = key.split(':')[1];
      running.push({
        script,
        startTime: value.startTime
      });
    }
  }
  
  res.json({ success: true, data: running });
});

// Deployment
app.post('/api/deploy/git', (req, res) => {
  const { repoUrl, branch = 'main', targetPath, installDeps = true } = req.body;
  
  if (!repoUrl) {
    return res.status(400).json({ success: false, error: 'repoUrl required' });
  }
  
  const id = targetPath || repoUrl.split('/').pop().replace('.git', '');
  const appPath = path.join(APPS_PATH, id);
  
  // Clone
  exec(`git clone ${repoUrl} ${appPath} ${branch ? `-b ${branch}` : ''}`, (err) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
    
    // Install deps if needed
    if (installDeps) {
      exec('npm install', { cwd: appPath }, (err) => {
        if (err) {
          console.error('npm install failed:', err.message);
        }
        res.json({ success: true, data: { id, path: appPath } });
      });
    } else {
      res.json({ success: true, data: { id, path: appPath } });
    }
  });
});

app.post('/api/deploy/zip', (req, res) => {
  // Simplified - would need multipart handling
  res.status(501).json({ success: false, error: 'ZIP deployment not implemented yet' });
});

// Icons
app.get('/api/icons', (req, res) => {
  const icons = [];
  if (fs.existsSync(ICONS_PATH)) {
    for (const file of fs.readdirSync(ICONS_PATH)) {
      const stats = fs.statSync(path.join(ICONS_PATH, file));
      icons.push({
        filename: file,
        size: stats.size,
        uploadedAt: stats.mtime
      });
    }
  }
  res.json({ success: true, data: icons });
});

app.post('/api/icons', (req, res) => {
  // Simplified - would need file upload handling
  res.status(501).json({ success: false, error: 'Icon upload not implemented yet' });
});

// Logs API
app.get('/api/apps/:id/logs', (req, res) => {
  const { id } = req.params;
  const logs = getLogs(id);
  res.json({ success: true, data: logs });
});

// Clear logs
app.delete('/api/apps/:id/logs', (req, res) => {
  const { id } = req.params;
  logBuffer.delete(id);
  res.json({ success: true });
});
// Logs WebSocket
const wsClients = new Map();
const logBuffer = new Map();  // Store logs per app (max 1000 lines)
const MAX_LOG_LINES = 1000;

function addLog(appId, logEntry) {
  if (!logBuffer.has(appId)) {
    logBuffer.set(appId, []);
  }
  const logs = logBuffer.get(appId);
  const timestamp = new Date().toISOString();
  logs.push({ ...logEntry, timestamp });
  
  // Keep only last N lines
  if (logs.length > MAX_LOG_LINES) {
    logs.shift();
  }
}

function getLogs(appId) {
  return logBuffer.get(appId) || [];
}

function broadcastLog(appId, message) {
  // Store log first
  addLog(appId, message);
  
  const clients = wsClients.get(appId) || [];
  // console.log(`[WS] Broadcasting to ${clients.length} clients for ${appId}:`, message.type);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify(message));
      } catch (e) {
        console.error('[WS] Send error:', e.message);
      }
    }
  });
}

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost:3000'}`);
  const appId = url.searchParams.get('app');
  
  console.log(`[WS] Connection: ${req.url} -> appId=${appId}`);
  
  if (appId) {
    if (!wsClients.has(appId)) wsClients.set(appId, []);
    wsClients.get(appId).push(ws);
    console.log(`[WS] Subscribed ${appId}, total clients: ${wsClients.get(appId).length}`);
    
    ws.on('close', () => {
      const clients = wsClients.get(appId);
      const idx = clients ? clients.indexOf(ws) : -1;
      if (idx !== -1) clients.splice(idx, 1);
      console.log(`[WS] Disconnected ${appId}, remaining: ${clients ? clients.length : 0}`);
    });
    
    ws.on('error', (err) => {
      console.error(`[WS] Error for ${appId}:`, err.message);
    });
  }
});

// Health
app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
});

// SPA fallback - must be last
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ success: false, error: err.message });
});

server.listen(PORT, () => {
  console.log(`🌙 yo-node-portal running on http://localhost:${PORT}`);
  console.log(`Apps path: ${APPS_PATH}`);
});
