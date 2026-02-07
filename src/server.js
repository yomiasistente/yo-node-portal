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

// Track running processes: Map<"appId:scriptName", { proc, pid, startTime }>
const runningProcesses = new Map();

// ============ State Persistence ============

function saveRunningState() {
  try {
    const state = {};
    for (const [key, value] of runningProcesses) {
      state[key] = {
        pid: value.pid,
        startTime: value.startTime.toISOString()
      };
    }
    fs.writeFileSync(RUNNING_STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('Error saving running state:', e.message);
  }
}

function loadRunningState() {
  if (!fs.existsSync(RUNNING_STATE_FILE)) return;
  
  try {
    const state = JSON.parse(fs.readFileSync(RUNNING_STATE_FILE, 'utf8'));
    for (const [key, value] of Object.entries(state)) {
      // Verify process is still alive
      try {
        process.kill(value.pid, 0);
        runningProcesses.set(key, {
          pid: value.pid,
          startTime: new Date(value.startTime)
        });
        console.log(`[State] Loaded: ${key} (PID ${value.pid})`);
      } catch (e) {
        // Process dead, skip
      }
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

// Helper function to get scripts for an app
function getAppScripts(appId) {
  const appPath = path.join(APPS_PATH, appId);
  const packagePath = path.join(appPath, 'package.json');
  const configPath = path.join(appPath, '.portal-config.json');
  
  const scripts = [];
  
  try {
    let packageScripts = {};
    if (fs.existsSync(packagePath)) {
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      packageScripts = packageJson.scripts || {};
    }
    
    const configJson = fs.existsSync(configPath)
      ? JSON.parse(fs.readFileSync(configPath, 'utf8'))
      : {};
    
    const customScripts = configJson.customScripts || {};
    const deletedScripts = configJson.deletedScripts || [];
    
    // Add package.json scripts (all, even deleted)
    for (const [name, command] of Object.entries(packageScripts)) {
      const isDeleted = deletedScripts.includes(name);
      const custom = customScripts[name] || {};
      scripts.push({
        name,
        command,
        label: custom.label || name,
        description: custom.description || '',
        type: 'package',
        deleted: isDeleted,
        executable: true
      });
    }
    
    // Add custom scripts
    for (const [name, data] of Object.entries(customScripts)) {
      if (!packageScripts[name]) {
        scripts.push({
          name,
          command: data.command || '',
          label: data.label || name,
          description: data.description || '',
          type: 'custom',
          deleted: false,
          executable: true
        });
      }
    }
  } catch (e) {
    console.error(`Error getting scripts for ${appId}:`, e.message);
  }
  
  return scripts;
}

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
              scripts: getAppScripts(entry.name),
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
        scripts: getAppScripts(id),
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
  const { title, description, icon, category } = req.body;
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
    config.lastUpdated = new Date().toISOString();
    
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    res.json({ success: true, data: config });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ============ Scripts CRUD ============

app.get('/api/apps/:id/scripts', (req, res) => {
  const { id } = req.params;
  const appPath = path.join(APPS_PATH, id);
  const packagePath = path.join(appPath, 'package.json');
  const configPath = path.join(appPath, '.portal-config.json');
  
  const scripts = [];
  
  try {
    // Get package.json scripts
    let packageScripts = {};
    if (fs.existsSync(packagePath)) {
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      packageScripts = packageJson.scripts || {};
    }
    
    // Get custom scripts from config
    const configJson = fs.existsSync(configPath)
      ? JSON.parse(fs.readFileSync(configPath, 'utf8'))
      : {};
    
    const customScripts = configJson.customScripts || {};
    const deletedScripts = configJson.deletedScripts || [];
    
    // Add package.json scripts (not deleted)
    for (const [name, command] of Object.entries(packageScripts)) {
      if (!deletedScripts.includes(name)) {
        const custom = customScripts[name] || {};
        scripts.push({
          name,
          command,
          label: custom.label || name,
          description: custom.description || '',
          type: 'package',
          executable: true
        });
      }
    }
    
    // Add custom scripts
    for (const [name, data] of Object.entries(customScripts)) {
      if (!packageScripts[name]) {
        scripts.push({
          name,
          command: data.command || '',
          label: data.label || name,
          description: data.description || '',
          type: 'custom',
          executable: true
        });
      }
    }
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
  
  res.json({ success: true, data: scripts });
});

// Create or update script
app.put('/api/apps/:id/script', (req, res) => {
  const { id } = req.params;
  const { name, command, label, description } = req.body;
  
  if (!name) {
    return res.status(400).json({ success: false, error: 'Script name required' });
  }
  
  const appPath = path.join(APPS_PATH, id);
  const configPath = path.join(appPath, '.portal-config.json');
  
  if (!fs.existsSync(appPath)) {
    return res.status(404).json({ success: false, error: 'App not found' });
  }
  
  try {
    const config = fs.existsSync(configPath)
      ? JSON.parse(fs.readFileSync(configPath, 'utf8'))
      : {};
    
    config.customScripts = config.customScripts || {};
    config.customScripts[name] = {
      command: command || '',
      label: label || name,
      description: description || ''
    };
    config.lastUpdated = new Date().toISOString();
    
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    res.json({ success: true, data: config.customScripts[name] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Delete script
app.delete('/api/apps/:id/script/:script', (req, res) => {
  const { id, script } = req.params;
  const appPath = path.join(APPS_PATH, id);
  const configPath = path.join(appPath, '.portal-config.json');
  
  if (!fs.existsSync(appPath)) {
    return res.status(404).json({ success: false, error: 'App not found' });
  }
  
  try {
    const config = fs.existsSync(configPath)
      ? JSON.parse(fs.readFileSync(configPath, 'utf8'))
      : {};
    
    // Check if script exists in package.json (mark as deleted)
    const packagePath = path.join(appPath, 'package.json');
    if (fs.existsSync(packagePath)) {
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      if (packageJson.scripts && packageJson.scripts[script]) {
        // Mark as deleted in package.json scripts
        config.deletedScripts = config.deletedScripts || [];
        if (!config.deletedScripts.includes(script)) {
          config.deletedScripts.push(script);
        }
        // Remove from customScripts if exists
        if (config.customScripts && config.customScripts[script]) {
          delete config.customScripts[script];
        }
      }
    }
    
    // If custom script, remove from customScripts
    if (config.customScripts && config.customScripts[script]) {
      delete config.customScripts[script];
    }
    
    config.lastUpdated = new Date().toISOString();
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    res.json({ success: true, data: { name: script } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Restore deleted package.json script
app.post('/api/apps/:id/script/:script/restore', (req, res) => {
  const { id, script } = req.params;
  const appPath = path.join(APPS_PATH, id);
  const configPath = path.join(appPath, '.portal-config.json');
  
  if (!fs.existsSync(appPath)) {
    return res.status(404).json({ success: false, error: 'App not found' });
  }
  
  try {
    const config = fs.existsSync(configPath)
      ? JSON.parse(fs.readFileSync(configPath, 'utf8'))
      : {};
    
    if (config.deletedScripts) {
      config.deletedScripts = config.deletedScripts.filter(s => s !== script);
    }
    if (config.customScripts && config.customScripts[script]) {
      delete config.customScripts[script];
    }
    
    config.lastUpdated = new Date().toISOString();
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Execute script
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
  
  // Get script command from config (custom overrides package.json)
  const configPath = path.join(appPath, '.portal-config.json');
  const packagePath = path.join(appPath, 'package.json');
  
  let command = 'node';
  let args = [];
  
  try {
    // First check custom scripts in config
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const customScript = config.customScripts?.[script];
      if (customScript && customScript.command) {
        const parts = customScript.command.split(/\s+/);
        command = parts[0];
        args = parts.slice(1);
        console.log(`[Script] Using custom command for ${script}: ${customScript.command}`);
      }
    }
    
    // If not found, check package.json
    if (args.length === 0 && fs.existsSync(packagePath)) {
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      const scriptCmd = packageJson.scripts?.[script];
      if (scriptCmd) {
        const parts = scriptCmd.split(/\s+/);
        command = parts[0];
        args = parts.slice(1);
        console.log(`[Script] Using package.json command for ${script}: ${scriptCmd}`);
      }
    }
  } catch (e) {
    console.error(`[Script] Error getting command for ${script}:`, e.message);
  }
  
  // Execute the script
  const proc = spawn(command, args, {
    cwd: appPath,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env }
  });
  
  const startTime = new Date();
  
  // Track the process
  runningProcesses.set(key, { proc, pid: proc.pid, startTime });
  saveRunningState();
  console.log(`[Script] Started ${key} with PID ${proc.pid}`);
  
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
    saveRunningState();
    broadcastLog(id, { type: 'exit', data: code !== null ? code.toString() : 'killed' });
    res.json({ success: true, data: { code, output } });
  });
  
  proc.on('error', (err) => {
    runningProcesses.delete(key);
    saveRunningState();
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
  
  const { pid } = runningProcesses.get(key);
  const appPath = path.join(APPS_PATH, id);
  
  // Try multiple kill strategies
  const killStrategies = [
    // Strategy 1: Kill process group
    () => process.kill(-pid, 'SIGKILL'),
    // Strategy 2: Kill direct PID
    () => process.kill(pid, 'SIGKILL'),
    // Strategy 3: Find and kill by command line
    () => {
      const { execSync } = require('child_process');
      execSync(`pkill -f "node.*${script}" 2>/dev/null || true`);
    }
  ];
  
  for (const strategy of killStrategies) {
    try {
      strategy();
    } catch (e) {
      // Ignore errors, try next strategy
    }
  }
  
  runningProcesses.delete(key);
  saveRunningState();
  broadcastLog(id, { type: 'info', data: `Proceso "${script}" matado` });
  
  res.json({ success: true, data: { key } });
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
  
  if (appId) {
    if (!wsClients.has(appId)) wsClients.set(appId, []);
    wsClients.get(appId).push(ws);
    
    ws.on('close', () => {
      const clients = wsClients.get(appId);
      const idx = clients ? clients.indexOf(ws) : -1;
      if (idx !== -1) clients.splice(idx, 1);
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
