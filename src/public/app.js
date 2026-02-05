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

    // Computed
    const filteredApps = computed(() => {
      if (!searchQuery.value) return apps.value;
      const query = searchQuery.value.toLowerCase();
      return apps.value.filter(a => 
        a.name.toLowerCase().includes(query) ||
        a.description?.toLowerCase().includes(query) ||
        a.category?.toLowerCase().includes(query)
      );
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

    const openConfig = (app) => {
      configApp.value = app;
      configForm.value = {
        title: app.name,
        description: app.description || '',
        category: app.category || '',
        visibleScripts: app.scripts?.map(s => s.name) || []
      };
    };

    const showScript = (app, scriptName) => {
      const visible = configForm.value.visibleScripts || [];
      if (!visible.includes(scriptName)) {
        configForm.value.visibleScripts.push(scriptName);
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

    const openLogs = (app) => {
      logsApp.value = app;
      logs.value = [];
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
      // Simplified - would need real process tracking
      return false;
    };

    const showNotification = (message, type = 'info') => {
      const id = Date.now();
      notifications.value.push({ id, message, type });
      setTimeout(() => {
        notifications.value = notifications.value.filter(n => n.id !== id);
      }, 5000);
    };

    // Lifecycle
    onMounted(() => {
      fetchApps();
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
      hiddenScripts,
      logsApp,
      logs,
      logsContainer,
      runningScripts,
      deployApp,
      runScript,
      openConfig,
      showScript,
      saveConfig,
      openLogs,
      closeLogs,
      isRunning
    };
  }
});

app.mount('#app');
