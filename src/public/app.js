const { createApp, ref, computed, onMounted, nextTick } = Vue;

const app = createApp({
  setup() {
    // State
    const apps = ref([]);
    const searchQuery = ref('');
    const showDeployModal = ref(false);
    const configApp = ref(null);
    const logsApp = ref(null);
    const logs = ref([]);
    const logsContainer = ref(null);
    const notifications = ref([]);
    const runningScripts = ref(new Set());

    // Deploy form
    const deployForm = ref({
      repoUrl: '',
      branch: '',
      targetPath: '',
      installDeps: true
    });
    const deploying = ref(false);

    // Config form
    const configForm = ref({
      title: '',
      description: '',
      category: '',
      visibleScripts: []
    });
    const saving = ref(false);
    const deleting = ref(false);
    const editingScript = ref(false);
    
    const scriptForm = ref({
      name: '',
      command: '',
      label: '',
      description: ''
    });

    // Computed
    const filteredApps = computed(() => {
      if (!searchQuery.value) return apps.value;
      const query = searchQuery.value.toLowerCase();
      return apps.value.filter(a => a && (
        a.name?.toLowerCase().includes(query) ||
        a.description?.toLowerCase().includes(query) ||
        a.category?.toLowerCase().includes(query)
      ));
    });

    const hiddenScripts = computed(() => {
      if (!configApp.value) return [];
      const visible = configForm.value.visibleScripts || [];
      const allScripts = configApp.value.scripts?.map(s => s.name) || [];
      return allScripts.filter(s => !visible.includes(s));
    });

    // API
    const API_BASE = '/api';

    // Methods
    const fetchApps = async () => {
      try {
        const res = await fetch(`${API_BASE}/apps`);
        const data = await res.json();
        if (data.success) {
          apps.value = data.data;
          
          // Update running scripts state from server
          const newRunning = new Set();
          for (const app of data.data) {
            for (const scriptName of (app.runningScripts || [])) {
              newRunning.add(`${app.id}:${scriptName}`);
            }
          }
          runningScripts.value = newRunning;
        }
      } catch (err) {
        showNotification('Error cargando aplicaciones', 'error');
      }
    };

    const deployApp = async () => {
      if (!deployForm.value.repoUrl) {
        showNotification('URL del repositorio requerida', 'error');
        return;
      }

      deploying.value = true;
      
      try {
        const res = await fetch(`${API_BASE}/deploy/git`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            repoUrl: deployForm.value.repoUrl,
            branch: deployForm.value.branch || undefined,
            targetPath: deployForm.value.targetPath || undefined,
            installDeps: deployForm.value.installDeps
          })
        });
        
        const data = await res.json();
        if (data.success) {
          showNotification('Aplicación desplegada correctamente', 'success');
          showDeployModal.value = false;
          deployForm.value = { repoUrl: '', branch: '', targetPath: '', installDeps: true };
          fetchApps();
        } else {
          showNotification(data.error || 'Error al desplegar', 'error');
        }
      } catch (err) {
        showNotification('Error al desplegar', 'error');
      } finally {
        deploying.value = false;
      }
    };

    const runScript = async (app, scriptName) => {
      const key = `${app.id}:${scriptName}`;
      if (runningScripts.value.has(key)) return;
      
      runningScripts.value.add(key);
      
      try {
        const res = await fetch(`${API_BASE}/apps/${app.id}/script/${scriptName}`, {
          method: 'POST'
        });
        
        const data = await res.json();
        if (data.success) {
          showNotification(`Script "${scriptName}" ejecutado`, 'success');
        } else {
          showNotification(data.error || 'Error ejecutando script', 'error');
        }
      } catch (err) {
        showNotification('Error ejecutando script', 'error');
      } finally {
        runningScripts.value.delete(key);
      }
    };

    const killScript = async (app, scriptName) => {
      const key = `${app.id}:${scriptName}`;
      
      if (!confirm(`¿Estás seguro de que quieres matar el proceso "${scriptName}"?`)) {
        return;
      }
      
      try {
        const res = await fetch(`${API_BASE}/apps/${app.id}/kill`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ script: scriptName })
        });
        
        const data = await res.json();
        if (data.success) {
          showNotification(`Proceso "${scriptName}" matado`, 'success');
          runningScripts.value.delete(key);
        } else {
          showNotification(data.error || 'Error matando proceso', 'error');
        }
      } catch (err) {
        showNotification('Error matando proceso', 'error');
      }
    };

    const openConfig = (app) => {
      configApp.value = app;
      configForm.value = {
        title: app.name,
        description: app.description || '',
        category: app.category || '',
        visibleScripts: app.scripts?.map(s => s.name) || []
      };
      resetScriptForm();
    };

    const showScript = (app, scriptName) => {
      const visible = configForm.value.visibleScripts || [];
      if (!visible.includes(scriptName)) {
        configForm.value.visibleScripts.push(scriptName);
      }
    };

    const resetScriptForm = () => {
      scriptForm.value = { name: '', command: '', label: '', description: '' };
      editingScript.value = false;
    };

    const addScript = async () => {
      if (!configApp.value) return;
      if (!scriptForm.value.name || !scriptForm.value.command) {
        showNotification('Nombre y comando requeridos', 'error');
        return;
      }
      
      try {
        const res = await fetch(`${API_BASE}/apps/${configApp.value.id}/script`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(scriptForm.value)
        });
        
        const data = await res.json();
        if (data.success) {
          showNotification('Script creado correctamente', 'success');
          resetScriptForm();
          fetchAppDetails(); // Refresh scripts list
        } else {
          showNotification(data.error || 'Error creando script', 'error');
        }
      } catch (err) {
        showNotification('Error creando script', 'error');
      }
    };

    const editScript = (script) => {
      scriptForm.value = {
        name: script.name,
        command: script.command,
        label: script.label || '',
        description: script.description || ''
      };
      editingScript.value = true;
    };

    const saveScript = async () => {
      if (!configApp.value) return;
      if (!scriptForm.value.name || !scriptForm.value.command) {
        showNotification('Nombre y comando requeridos', 'error');
        return;
      }
      
      try {
        const res = await fetch(`${API_BASE}/apps/${configApp.value.id}/script`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(scriptForm.value)
        });
        
        const data = await res.json();
        if (data.success) {
          showNotification('Script actualizado correctamente', 'success');
          resetScriptForm();
          fetchAppDetails(); // Refresh scripts list
        } else {
          showNotification(data.error || 'Error actualizando script', 'error');
        }
      } catch (err) {
        showNotification('Error actualizando script', 'error');
      }
    };

    const deleteScript = async (script) => {
      if (!confirm(`¿Estás seguro de borrar "${script.label || script.name}"?`)) {
        return;
      }
      
      try {
        const res = await fetch(`${API_BASE}/apps/${configApp.value.id}/script/${script.name}`, {
          method: 'DELETE'
        });
        
        const data = await res.json();
        if (data.success) {
          showNotification(script.type === 'package' ? 'Script ocultado' : 'Script borrado', 'success');
          fetchAppDetails(); // Refresh scripts list
        } else {
          showNotification(data.error || 'Error borrando script', 'error');
        }
      } catch (err) {
        showNotification('Error borrando script', 'error');
      }
    };

    const restoreScript = async (script) => {
      try {
        const res = await fetch(`${API_BASE}/apps/${configApp.value.id}/script/${script.name}/restore`, {
          method: 'POST'
        });
        
        const data = await res.json();
        if (data.success) {
          showNotification('Script restaurado', 'success');
          fetchAppDetails(); // Refresh scripts list
        } else {
          showNotification(data.error || 'Error restaurando script', 'error');
        }
      } catch (err) {
        showNotification('Error restaurando script', 'error');
      }
    };

    const fetchAppDetails = async () => {
      if (!configApp.value) return;
      try {
        const res = await fetch(`${API_BASE}/apps/${configApp.value.id}`);
        const data = await res.json();
        if (data.success) {
          configApp.value.scripts = data.data.scripts;
        }
      } catch (err) {
        console.error('Error fetching app details:', err);
      }
    };

    const saveConfig = async () => {
      if (!configApp.value) return;
      
      saving.value = true;
      
      try {
        const hidden = hiddenScripts.value;
        const customScripts = {};
        
        for (const script of configApp.value.scripts || []) {
          if (configForm.value.visibleScripts.includes(script.name)) {
            customScripts[script.name] = {
              label: script.label,
              description: script.description
            };
          }
        }
        
        const res = await fetch(`${API_BASE}/apps/${configApp.value.id}/config`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: configForm.value.title,
            description: configForm.value.description,
            category: configForm.value.category,
            hiddenScripts: hidden,
            customScripts
          })
        });
        
        const data = await res.json();
        if (data.success) {
          showNotification('Configuración guardada', 'success');
          configApp.value = null;
          fetchApps();
        } else {
          showNotification(data.error || 'Error guardando', 'error');
        }
      } catch (err) {
        showNotification('Error guardando configuración', 'error');
      } finally {
        saving.value = false;
      }
    };

    const deleteApp = async () => {
      if (!configApp.value) return;
      
      const appName = configApp.value.name;
      if (!confirm(`¿Estás seguro de que quieres borrar "${appName}"? Esta acción no se puede deshacer.`)) {
        return;
      }
      
      deleting.value = true;
      
      try {
        const res = await fetch(`${API_BASE}/apps/${configApp.value.id}`, {
          method: 'DELETE'
        });
        
        const data = await res.json();
        if (data.success) {
          showNotification(`"${appName}" ha sido borrada`, 'success');
          configApp.value = null;
          fetchApps();
        } else {
          showNotification(data.error || 'Error borrando aplicación', 'error');
        }
      } catch (err) {
        showNotification('Error borrando aplicación', 'error');
      } finally {
        deleting.value = false;
      }
    };

    const openLogs = async (app) => {
      logsApp.value = app;
      logs.value = [];
      
      // Fetch historical logs first
      try {
        const res = await fetch(`${API_BASE}/apps/${app.id}/logs`);
        const data = await res.json();
        if (data.success && data.data) {
          logs.value = data.data;
          
          nextTick(() => {
            if (logsContainer.value) {
              logsContainer.value.scrollTop = logsContainer.value.scrollHeight;
            }
          });
        }
      } catch (err) {
        console.error('Error fetching logs:', err);
      }
      
      // Then connect to live stream
      connectLogStream(app.id);
    };

    const closeLogs = () => {
      logsApp.value = null;
      logs.value = [];
    };

    const connectLogStream = (appId) => {
      const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/apps/${appId}/logs/stream?app=${appId}`;
      console.log('[WS] Connecting to:', wsUrl);
      
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('[WS] Connected');
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        logs.value.push(data);
        
        nextTick(() => {
          if (logsContainer.value) {
            logsContainer.value.scrollTop = logsContainer.value.scrollHeight;
          }
        });
      };
      
      ws.onerror = (error) => {
        console.error('[WS] Error:', error);
      };
      
      ws.onclose = (event) => {
        console.log('[WS] Closed:', event.code, event.reason);
        if (logsApp.value && logsApp.value.id === appId) {
          // Try to reconnect after 3 seconds
          setTimeout(() => connectLogStream(appId), 3000);
        }
      };
    };

    const isRunning = (appId) => {
      // Check if any script for this app is running
      for (const key of runningScripts.value) {
        if (key.startsWith(`${appId}:`)) {
          return true;
        }
      }
      return false;
    };

    const isScriptRunning = (appId, scriptName) => {
      return runningScripts.value.has(`${appId}:${scriptName}`);
    };

    const showNotification = (message, type = 'info') => {
      const id = Date.now();
      notifications.value.push({ id, message, type });
      setTimeout(() => {
        notifications.value = notifications.value.filter(n => n.id !== id);
      }, 5000);
    };

    // Poll for running state every 5 seconds
    let pollInterval;
    
    // Lifecycle
    onMounted(() => {
      fetchApps();
      pollInterval = setInterval(fetchApps, 5000);
    });

    return {
      apps,
      searchQuery,
      filteredApps,
      showDeployModal,
      deployForm,
      deploying,
      configApp,
      configForm,
      saving,
      deleting,
      scriptForm,
      editingScript,
      hiddenScripts,
      logsApp,
      logs,
      logsContainer,
      runningScripts,
      deployApp,
      runScript,
      killScript,
      openConfig,
      saveConfig,
      deleteApp,
      addScript,
      editScript,
      saveScript,
      deleteScript,
      restoreScript,
      openLogs,
      closeLogs,
      isRunning,
      isScriptRunning
    };
  }
});

app.mount('#app');
