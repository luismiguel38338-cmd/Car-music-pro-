/**
 * RADIO MUSICOLOGOS — PANEL DE ADMINISTRACIÓN & MONITOREO DE USUARIOS EN VIVO
 * Sistema de presencia en tiempo real y gestión de administradores
 */

(function () {
  // 1. GESTIÓN DE SESIÓN DE USUARIO PARA PRESENCIA EN VIVO
  let sessionId = sessionStorage.getItem('rd_sid');
  if (!sessionId) {
    sessionId = 'u_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36).slice(-4);
    sessionStorage.setItem('rd_sid', sessionId);
  }

  let userAlias = localStorage.getItem('rd_user_alias') || `Visitante #${sessionId.slice(-4)}`;
  let lastSeenBroadcastId = '';
  let adminToken = sessionStorage.getItem('rd_admin_token') || null;
  let currentAdmin = null;
  try {
    const raw = sessionStorage.getItem('rd_admin_info');
    if (raw) currentAdmin = JSON.parse(raw);
  } catch (e) {}

  let activeTab = 'users';
  let refreshInterval = null;
  let knownUsers = [];
  let knownAdmins = [];

  // Heartbeat function to report presence
  function sendHeartbeat() {
    const isPlaying = document.body.classList.contains('playing') ||
      Boolean(document.querySelector('#face:not(.poff)')) &&
      !Boolean(document.querySelector('#face.poff'));

    const radioEl = document.querySelector('.case img.bg');
    const radioModel = radioEl ? (radioEl.getAttribute('alt') || 'Pioneer DEH-4250BT') : 'Pioneer DEH-4250BT';

    fetch('/api/presence/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: sessionId,
        alias: userAlias,
        isPlaying: isPlaying,
        radioModel: radioModel,
        volume: window.pioneerVolume || 25,
        eqCount: document.querySelectorAll('#eqs .eqw').length || 1,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.onlineCount !== undefined) {
          updateOnlineBadges(data.onlineCount);
        }
        if (data.messages && data.messages.length > 0) {
          handleBroadcastMessages(data.messages);
        }
      })
      .catch(() => {});
  }

  // Update online badges in UI
  function updateOnlineBadges(count) {
    const badge = document.getElementById('adminOnlineCountBadge');
    if (badge) {
      badge.textContent = count;
    }
  }

  // Display broadcast announcements from the Admin
  function handleBroadcastMessages(messages) {
    messages.forEach((msg) => {
      if (msg.id !== lastSeenBroadcastId && Date.now() - msg.timestamp < 15000) {
        lastSeenBroadcastId = msg.id;
        showBroadcastToast(msg);
      }
    });
  }

  function showBroadcastToast(msg) {
    const existing = document.querySelector('.broadcast-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'broadcast-toast';
    toast.innerHTML = `
      <div class="broadcast-toast-header">
        <span>📢 MENSAJE DEL ADMINISTRADOR (${escapeHtml(msg.sender)})</span>
        <button onclick="this.closest('.broadcast-toast').remove()" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:16px;">✕</button>
      </div>
      <div style="font-size:13px;line-height:1.5;color:#f8fafc;word-break:break-word;">
        ${escapeHtml(msg.text)}
      </div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      if (toast && toast.parentNode) toast.remove();
    }, 9000);
  }

  // Start continuous heartbeat
  sendHeartbeat();
  setInterval(sendHeartbeat, 5000);

  // 2. CONSTRUCCIÓN DE LA INTERFAZ DEL PANEL DE ADMINISTRACIÓN
  function injectAdminUI() {
    // A. Botón flotante superior
    if (!document.getElementById('adminTriggerBtn')) {
      const floatBtn = document.createElement('button');
      floatBtn.id = 'adminTriggerBtn';
      floatBtn.className = 'admin-float-btn';
      floatBtn.type = 'button';
      floatBtn.title = 'Panel de Administrador y Usuarios Conectados';
      floatBtn.innerHTML = `
        <span class="admin-badge-icon">👑</span>
        <span class="admin-badge-txt">ADMIN</span>
        <span class="admin-online-indicator">
          <span class="admin-dot"></span>
          <span id="adminOnlineCountBadge">1</span>
        </span>
      `;
      floatBtn.addEventListener('click', openAdminModal);
      document.body.appendChild(floatBtn);
    }

    // B. Botón en el sidebar `.promo`
    const promo = document.getElementById('promo');
    if (promo && !document.getElementById('promoAdminBtn')) {
      const pc = document.createElement('div');
      pc.className = 'pc';
      pc.innerHTML = `
        <button class="kitb admin-pc-btn" id="promoAdminBtn" type="button">👑 Panel de Administrador</button>
        <p>Gestionar administradores y ver usuarios en línea</p>
      `;
      pc.querySelector('#promoAdminBtn').addEventListener('click', openAdminModal);
      // Insert at top or bottom of promo
      promo.insertBefore(pc, promo.firstChild);
    }

    // C. Modal Principal
    if (!document.getElementById('adminModal')) {
      const modal = document.createElement('div');
      modal.id = 'adminModal';
      modal.className = 'adm-modal-overlay';
      modal.innerHTML = `
        <div class="adm-modal-card">
          <!-- Cabecera -->
          <div class="adm-header">
            <div class="adm-title-wrap">
              <span class="adm-icon-crown">👑</span>
              <div>
                <h3 class="adm-title">Panel de Control & Administrador</h3>
                <p class="adm-subtitle">Monitoreo de usuarios en vivo y gestión de accesos</p>
              </div>
            </div>
            <button class="adm-close-btn" id="admCloseBtn" aria-label="Cerrar">✕</button>
          </div>

          <!-- Contenido dinámico (Login o Dashboard) -->
          <div id="admContentArea" style="display:flex;flex-direction:column;flex:1;overflow:hidden;"></div>
        </div>
      `;
      document.body.appendChild(modal);

      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeAdminModal();
      });
      document.getElementById('admCloseBtn').addEventListener('click', closeAdminModal);
    }
  }

  function openAdminModal() {
    injectAdminUI();
    const modal = document.getElementById('adminModal');
    if (modal) {
      modal.classList.add('open');
      renderAdminContent();
    }
  }

  function closeAdminModal() {
    const modal = document.getElementById('adminModal');
    if (modal) {
      modal.classList.remove('open');
      if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
      }
    }
  }

  // Render modal content: Login or Full Dashboard
  function renderAdminContent() {
    const area = document.getElementById('admContentArea');
    if (!area) return;

    if (!adminToken) {
      renderLoginForm(area);
    } else {
      renderDashboard(area);
    }
  }

  // 3. PANTALLA DE INICIO DE SESIÓN PARA ADMINISTRADORES
  function renderLoginForm(container) {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }

    container.innerHTML = `
      <div class="adm-body" style="display:flex;align-items:center;justify-content:center;">
        <div class="adm-login-box">
          <div style="font-size:36px;margin-bottom:8px;">🔒</div>
          <h4 class="adm-login-title">Acceso de Administrador</h4>
          <p class="adm-login-desc">Ingresa tus credenciales para acceder al panel de control y ver usuarios conectados.</p>
          
          <form id="admLoginForm">
            <div class="adm-form-group">
              <label class="adm-label" for="admUser">Usuario</label>
              <input type="text" id="admUser" class="adm-input" placeholder="admin" value="admin" required />
            </div>

            <div class="adm-form-group">
              <label class="adm-label" for="admPass">Contraseña</label>
              <input type="password" id="admPass" class="adm-input" placeholder="••••••••" value="admin123" required />
            </div>

            <div id="admLoginErr" style="color:#ef4444;font-size:12px;margin-bottom:14px;display:none;"></div>

            <button type="submit" class="adm-btn-primary" id="admLoginSubmitBtn">
              Ingresar al Panel
            </button>
          </form>

          <div class="adm-login-hint">
            <strong>Credenciales por defecto:</strong><br>
            Usuario: <code style="color:#38bdf8;">admin</code><br>
            Contraseña: <code style="color:#38bdf8;">admin123</code><br>
            <em>Puedes agregar más administradores y cambiar configuraciones una vez ingreses.</em>
          </div>
        </div>
      </div>
    `;

    const form = document.getElementById('admLoginForm');
    form.addEventListener('submit', handleLogin);
  }

  function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('admUser').value;
    const password = document.getElementById('admPass').value;
    const errBox = document.getElementById('admLoginErr');
    const btn = document.getElementById('admLoginSubmitBtn');

    errBox.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'Verificando...';

    fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
      .then((res) => res.json())
      .then((data) => {
        btn.disabled = false;
        btn.textContent = 'Ingresar al Panel';

        if (data.success && data.token) {
          adminToken = data.token;
          currentAdmin = data.admin;
          sessionStorage.setItem('rd_admin_token', adminToken);
          sessionStorage.setItem('rd_admin_info', JSON.stringify(currentAdmin));
          renderAdminContent();
        } else {
          errBox.textContent = data.error || 'Credenciales inválidas.';
          errBox.style.display = 'block';
        }
      })
      .catch(() => {
        btn.disabled = false;
        btn.textContent = 'Ingresar al Panel';
        errBox.textContent = 'Error al comunicarse con el servidor.';
        errBox.style.display = 'block';
      });
  }

  function handleLogout() {
    adminToken = null;
    currentAdmin = null;
    sessionStorage.removeItem('rd_admin_token');
    sessionStorage.removeItem('rd_admin_info');
    renderAdminContent();
  }

  // 4. DASHBOARD DE ADMINISTRACIÓN
  function renderDashboard(container) {
    container.innerHTML = `
      <!-- Barra de navegación por pestañas -->
      <div class="adm-nav">
        <button class="adm-tab-btn ${activeTab === 'users' ? 'active' : ''}" data-tab="users">
          👥 Usuarios Conectados
          <span class="adm-tab-badge" id="admTabUserCount">0</span>
        </button>
        <button class="adm-tab-btn ${activeTab === 'admins' ? 'active' : ''}" data-tab="admins">
          🛡️ Administradores
          <span class="adm-tab-badge" id="admTabAdminCount">0</span>
        </button>
        <button class="adm-tab-btn ${activeTab === 'stats' ? 'active' : ''}" data-tab="stats">
          📊 Estadísticas del Sistema
        </button>
        <div style="margin-left:auto;display:flex;align-items:center;padding:0 8px;gap:12px;">
          <span style="font-size:12px;color:#94a3b8;">
            Hola, <strong style="color:#fff;">${escapeHtml(currentAdmin?.name || 'Admin')}</strong>
            <span class="adm-role-badge adm-role-super" style="margin-left:6px;">${escapeHtml(currentAdmin?.role || 'Super Admin')}</span>
          </span>
          <button id="admLogoutBtn" class="adm-btn-sm" style="color:#ef4444;border-color:#7f1d1d;" title="Cerrar sesión">
            Cerrar Sesión
          </button>
        </div>
      </div>

      <!-- Área de contenido de pestañas -->
      <div class="adm-body" id="admTabContent"></div>
    `;

    // Eventos de pestañas
    container.querySelectorAll('.adm-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeTab = btn.getAttribute('data-tab');
        container.querySelectorAll('.adm-tab-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        renderTabContent();
      });
    });

    document.getElementById('admLogoutBtn').addEventListener('click', handleLogout);

    renderTabContent();

    // Auto-refresh data every 3 seconds for active users
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(() => {
      if (activeTab === 'users' || activeTab === 'stats') {
        loadUsersData(false);
      }
    }, 3000);
  }

  function renderTabContent() {
    const tabArea = document.getElementById('admTabContent');
    if (!tabArea) return;

    if (activeTab === 'users') {
      renderUsersTab(tabArea);
      loadUsersData(true);
    } else if (activeTab === 'admins') {
      renderAdminsTab(tabArea);
      loadAdminsData();
    } else if (activeTab === 'stats') {
      renderStatsTab(tabArea);
      loadStatsData();
    }
  }

  // TAB 1: USUARIOS CONECTADOS
  function renderUsersTab(container) {
    container.innerHTML = `
      <!-- Barra superior de estadísticas rápidas -->
      <div class="adm-stats-bar">
        <div class="adm-stat-card">
          <span class="adm-stat-val" id="statConnectedNow">1</span>
          <span class="adm-stat-lbl">Usuarios Conectados Ahora</span>
        </div>
        <div class="adm-stat-card">
          <span class="adm-stat-val" id="statPeakUsers">1</span>
          <span class="adm-stat-lbl">Pico Máximo de Conectados</span>
        </div>
        <div class="adm-stat-card">
          <span class="adm-stat-val" id="statTotalVisits">1</span>
          <span class="adm-stat-lbl">Total de Sesiones Históricas</span>
        </div>
      </div>

      <!-- Barra de herramientas -->
      <div class="adm-toolbar">
        <div style="display:flex;align-items:center;gap:10px;">
          <input type="text" id="userSearchInput" class="adm-search-input" placeholder="Buscar por usuario, IP o SO..." />
          <span id="userFilterCount" style="font-size:12px;color:#94a3b8;"></span>
        </div>

        <div class="adm-actions-group">
          <button id="btnBroadcastAlert" class="adm-btn-sm adm-btn-accent">
            📢 Enviar Aviso a Todos
          </button>
          <button id="btnRefreshUsers" class="adm-btn-sm">
            🔄 Actualizar
          </button>
        </div>
      </div>

      <!-- Tabla de usuarios -->
      <div class="adm-table-wrap">
        <table class="adm-table">
          <thead>
            <tr>
              <th>Usuario / Sesión</th>
              <th>Dispositivo / SO</th>
              <th>Navegador</th>
              <th>IP Conexión</th>
              <th>Estado Actual</th>
              <th>Modelo Radio</th>
              <th>Tiempo en Línea</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody id="userTableBody">
            <tr>
              <td colspan="8" style="text-align:center;padding:24px;color:#94a3b8;">
                Cargando usuarios conectados...
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Submodal de Broadcast -->
      <div id="broadcastSubmodal" class="adm-submodal" style="display:none;">
        <div class="adm-submodal-box">
          <h4 class="adm-submodal-title">📢 Enviar Notificación Global</h4>
          <p style="font-size:12px;color:#94a3b8;margin-bottom:14px;">
            Este mensaje aparecerá instantáneamente en las pantallas de todos los usuarios conectados a la página.
          </p>
          <div class="adm-form-group">
            <label class="adm-label">Mensaje para los usuarios</label>
            <textarea id="broadcastTextInput" class="adm-input" rows="3" placeholder="Ej: ¡Bienvenidos! Acabamos de encender el nuevo juego de bajos 2-21." style="resize:none;"></textarea>
          </div>
          <div class="adm-submodal-btns">
            <button type="button" class="adm-btn-sm" id="btnCancelBroadcast">Cancelar</button>
            <button type="button" class="adm-btn-sm adm-btn-accent" id="btnSendBroadcast">Enviar Ahora</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btnRefreshUsers').addEventListener('click', () => loadUsersData(true));
    document.getElementById('userSearchInput').addEventListener('input', filterUsersTable);

    // Broadcast logic
    const bModal = document.getElementById('broadcastSubmodal');
    document.getElementById('btnBroadcastAlert').addEventListener('click', () => {
      bModal.style.display = 'flex';
      document.getElementById('broadcastTextInput').focus();
    });
    document.getElementById('btnCancelBroadcast').addEventListener('click', () => {
      bModal.style.display = 'none';
    });
    document.getElementById('btnSendBroadcast').addEventListener('click', sendBroadcastAlert);
  }

  function loadUsersData(showLoading = false) {
    const tbody = document.getElementById('userTableBody');
    if (!tbody) return;

    fetch('/api/presence/online')
      .then((res) => res.json())
      .then((data) => {
        knownUsers = data.users || [];

        // Update stats
        const statNow = document.getElementById('statConnectedNow');
        const statPeak = document.getElementById('statPeakUsers');
        const statVisits = document.getElementById('statTotalVisits');
        const tabBadge = document.getElementById('admTabUserCount');

        if (statNow) statNow.textContent = data.count || 0;
        if (statPeak) statPeak.textContent = data.peak || 0;
        if (statVisits) statVisits.textContent = data.totalVisits || 0;
        if (tabBadge) tabBadge.textContent = data.count || 0;
        updateOnlineBadges(data.count || 0);

        renderUsersRows(knownUsers);
      })
      .catch(() => {});
  }

  function filterUsersTable() {
    const query = (document.getElementById('userSearchInput')?.value || '').toLowerCase();
    const filtered = knownUsers.filter((u) => {
      return (
        u.alias.toLowerCase().includes(query) ||
        u.id.toLowerCase().includes(query) ||
        u.ip.toLowerCase().includes(query) ||
        u.device.toLowerCase().includes(query) ||
        u.browser.toLowerCase().includes(query) ||
        u.radioModel.toLowerCase().includes(query)
      );
    });
    renderUsersRows(filtered);
  }

  function renderUsersRows(users) {
    const tbody = document.getElementById('userTableBody');
    if (!tbody) return;

    if (!users || users.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center;padding:24px;color:#94a3b8;">
            No hay usuarios que coincidan con la búsqueda.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = users
      .map((user) => {
        const isCurrentSession = user.id === sessionId;
        const durationMin = Math.floor(user.onlineDurationSeconds / 60);
        const durationSec = user.onlineDurationSeconds % 60;
        const timeStr = durationMin > 0 ? `${durationMin}m ${durationSec}s` : `${durationSec}s`;

        return `
          <tr>
            <td>
              <div style="font-weight:700;color:#fff;display:flex;align-items:center;gap:6px;">
                ${escapeHtml(user.alias)}
                ${isCurrentSession ? '<span style="font-size:10px;padding:1px 5px;background:#0284c7;color:#fff;border-radius:4px;">Tú</span>' : ''}
              </div>
              <div style="font-size:10px;color:#64748b;font-family:monospace;">${escapeHtml(user.id)}</div>
            </td>
            <td>
              <span style="font-weight:600;">${escapeHtml(user.device)}</span>
            </td>
            <td>
              <span>${escapeHtml(user.browser)}</span>
            </td>
            <td>
              <code style="font-size:11px;color:#38bdf8;">${escapeHtml(user.ip)}</code>
            </td>
            <td>
              ${
                user.isPlaying
                  ? '<span class="adm-status-badge adm-status-playing">🔊 Sonando</span>'
                  : '<span class="adm-status-badge adm-status-idle">⏸ Pausado</span>'
              }
            </td>
            <td>
              <span style="font-size:12px;color:#cbd5e1;">${escapeHtml(user.radioModel)}</span>
            </td>
            <td>
              <span style="color:#94a3b8;font-size:12px;">${timeStr}</span>
            </td>
            <td>
              ${
                !isCurrentSession
                  ? `<button class="adm-btn-sm adm-btn-danger" onclick="window.disconnectUserSession('${user.id}')" style="padding:4px 8px;font-size:11px;">Desconectar</button>`
                  : '<span style="font-size:11px;color:#64748b;">Sesión actual</span>'
              }
            </td>
          </tr>
        `;
      })
      .join('');
  }

  // Disconnect a user session
  window.disconnectUserSession = function (userId) {
    if (!confirm('¿Estás seguro de desconectar esta sesión?')) return;
    fetch('/api/presence/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: userId }),
    }).then(() => {
      loadUsersData();
    });
  };

  // Send Broadcast Alert
  function sendBroadcastAlert() {
    const input = document.getElementById('broadcastTextInput');
    const text = (input?.value || '').trim();
    if (!text) {
      alert('Por favor escribe un mensaje.');
      return;
    }

    fetch('/api/presence/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        sender: currentAdmin?.name || 'Administrador',
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          document.getElementById('broadcastSubmodal').style.display = 'none';
          input.value = '';
          alert('¡Mensaje enviado exitosamente a todos los usuarios conectados!');
        }
      });
  }

  // TAB 2: GESTIÓN DE ADMINISTRADORES
  function renderAdminsTab(container) {
    container.innerHTML = `
      <div class="adm-toolbar">
        <div>
          <h4 style="margin:0 0 2px 0;font-family:'Oswald',sans-serif;font-size:18px;color:#fff;">ADMINISTRADORES DEL SISTEMA</h4>
          <p style="margin:0;font-size:12px;color:#94a3b8;">Gestiona las personas con privilegios de administración en la página.</p>
        </div>

        <button id="btnOpenAddAdminModal" class="adm-btn-sm adm-btn-accent" style="padding:9px 16px;">
          ➕ Agregar Administrador
        </button>
      </div>

      <!-- Tabla de Administradores -->
      <div class="adm-table-wrap">
        <table class="adm-table">
          <thead>
            <tr>
              <th>Nombre Completo</th>
              <th>Usuario de Acceso</th>
              <th>Correo Electrónico</th>
              <th>Rol / Rango</th>
              <th>Fecha de Creación</th>
              <th>Último Acceso</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody id="adminsTableBody">
            <tr>
              <td colspan="7" style="text-align:center;padding:24px;color:#94a3b8;">
                Cargando administradores...
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Submodal para Agregar Administrador -->
      <div id="addAdminSubmodal" class="adm-submodal" style="display:none;">
        <div class="adm-submodal-box">
          <h4 class="adm-submodal-title">➕ Agregar Nuevo Administrador</h4>
          <form id="addAdminForm">
            <div class="adm-form-group">
              <label class="adm-label" for="newAdmName">Nombre Completo</label>
              <input type="text" id="newAdmName" class="adm-input" placeholder="Ej: Luis Miguel" required />
            </div>

            <div class="adm-form-group">
              <label class="adm-label" for="newAdmUser">Usuario para Login</label>
              <input type="text" id="newAdmUser" class="adm-input" placeholder="Ej: luismiguel" required />
            </div>

            <div class="adm-form-group">
              <label class="adm-label" for="newAdmEmail">Correo Electrónico (opcional)</label>
              <input type="email" id="newAdmEmail" class="adm-input" placeholder="correo@musicologos.com" />
            </div>

            <div class="adm-form-group">
              <label class="adm-label" for="newAdmPass">Contraseña</label>
              <input type="password" id="newAdmPass" class="adm-input" placeholder="••••••••" required />
            </div>

            <div class="adm-form-group">
              <label class="adm-label" for="newAdmRole">Rol de Administración</label>
              <select id="newAdmRole" class="adm-input">
                <option value="Super Administrador">Super Administrador (Control Total)</option>
                <option value="Administrador" selected>Administrador</option>
                <option value="Moderador">Moderador</option>
              </select>
            </div>

            <div id="addAdminError" style="color:#ef4444;font-size:12px;margin-bottom:12px;display:none;"></div>

            <div class="adm-submodal-btns">
              <button type="button" class="adm-btn-sm" id="btnCancelAddAdmin">Cancelar</button>
              <button type="submit" class="adm-btn-sm adm-btn-accent" id="btnSaveAdmin">Guardar Administrador</button>
            </div>
          </form>
        </div>
      </div>
    `;

    const addModal = document.getElementById('addAdminSubmodal');
    document.getElementById('btnOpenAddAdminModal').addEventListener('click', () => {
      addModal.style.display = 'flex';
      document.getElementById('newAdmName').focus();
    });
    document.getElementById('btnCancelAddAdmin').addEventListener('click', () => {
      addModal.style.display = 'none';
    });
    document.getElementById('addAdminForm').addEventListener('submit', handleCreateAdmin);
  }

  function loadAdminsData() {
    fetch('/api/admin/list')
      .then((res) => res.json())
      .then((data) => {
        knownAdmins = data.admins || [];
        const tabBadge = document.getElementById('admTabAdminCount');
        if (tabBadge) tabBadge.textContent = knownAdmins.length;
        renderAdminsRows(knownAdmins);
      })
      .catch(() => {});
  }

  function renderAdminsRows(admins) {
    const tbody = document.getElementById('adminsTableBody');
    if (!tbody) return;

    tbody.innerHTML = admins
      .map((admin) => {
        const isCurrent = currentAdmin?.id === admin.id;
        const roleClass =
          admin.role === 'Super Administrador'
            ? 'adm-role-super'
            : admin.role === 'Moderador'
            ? 'adm-role-mod'
            : 'adm-role-admin';

        return `
          <tr>
            <td>
              <div style="font-weight:700;color:#fff;">
                ${escapeHtml(admin.name)}
                ${isCurrent ? '<span style="font-size:10px;padding:1px 5px;background:#0284c7;color:#fff;border-radius:4px;margin-left:6px;">Tú</span>' : ''}
              </div>
            </td>
            <td>
              <code style="color:#38bdf8;">${escapeHtml(admin.username)}</code>
            </td>
            <td>
              <span style="color:#94a3b8;">${escapeHtml(admin.email || '—')}</span>
            </td>
            <td>
              <span class="adm-role-badge ${roleClass}">${escapeHtml(admin.role)}</span>
            </td>
            <td>
              <span style="font-size:12px;color:#94a3b8;">${new Date(admin.createdAt).toLocaleDateString()}</span>
            </td>
            <td>
              <span style="font-size:12px;color:#cbd5e1;">${admin.lastLogin === 'Nunca' ? 'Nunca' : new Date(admin.lastLogin).toLocaleDateString()}</span>
            </td>
            <td>
              ${
                admins.length > 1 && !isCurrent
                  ? `<button class="adm-btn-sm adm-btn-danger" onclick="window.deleteAdminUser('${admin.id}')" style="padding:4px 8px;font-size:11px;">Eliminar</button>`
                  : '<span style="font-size:11px;color:#64748b;">Protegido</span>'
              }
            </td>
          </tr>
        `;
      })
      .join('');
  }

  function handleCreateAdmin(e) {
    e.preventDefault();
    const name = document.getElementById('newAdmName').value;
    const username = document.getElementById('newAdmUser').value;
    const email = document.getElementById('newAdmEmail').value;
    const password = document.getElementById('newAdmPass').value;
    const role = document.getElementById('newAdmRole').value;
    const errBox = document.getElementById('addAdminError');
    const submitBtn = document.getElementById('btnSaveAdmin');

    errBox.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Guardando...';

    fetch('/api/admin/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, username, email, password, role }),
    })
      .then((res) => res.json())
      .then((data) => {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Guardar Administrador';

        if (data.success) {
          document.getElementById('addAdminSubmodal').style.display = 'none';
          document.getElementById('addAdminForm').reset();
          loadAdminsData();
          alert(`¡Administrador "${name}" agregado con éxito!`);
        } else {
          errBox.textContent = data.error || 'Error al crear administrador.';
          errBox.style.display = 'block';
        }
      })
      .catch(() => {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Guardar Administrador';
        errBox.textContent = 'Error de conexión con el servidor.';
        errBox.style.display = 'block';
      });
  }

  window.deleteAdminUser = function (adminId) {
    if (!confirm('¿Estás seguro de que deseas eliminar este administrador?')) return;

    fetch(`/api/admin/${adminId}`, {
      method: 'DELETE',
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          loadAdminsData();
        } else {
          alert(data.error || 'No se pudo eliminar el administrador.');
        }
      });
  };

  // TAB 3: ESTADÍSTICAS DEL SISTEMA
  function renderStatsTab(container) {
    container.innerHTML = `
      <div class="adm-stats-bar" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
        <div class="adm-stat-card">
          <span class="adm-stat-val" id="statLiveUsersCount">—</span>
          <span class="adm-stat-lbl">Usuarios Conectados Ahora</span>
        </div>
        <div class="adm-stat-card">
          <span class="adm-stat-val" id="statMaxPeakCount">—</span>
          <span class="adm-stat-lbl">Pico Máximo de Usuarios</span>
        </div>
        <div class="adm-stat-card">
          <span class="adm-stat-val" id="statServerUptime">—</span>
          <span class="adm-stat-lbl">Tiempo de Actividad Servidor</span>
        </div>
        <div class="adm-stat-card">
          <span class="adm-stat-val" id="statAdminsCount">—</span>
          <span class="adm-stat-lbl">Total Administradores</span>
        </div>
      </div>

      <div style="background:#11141c;border:1px solid #1f2532;border-radius:12px;padding:20px;margin-top:16px;">
        <h4 style="margin:0 0 12px 0;font-family:'Oswald',sans-serif;font-size:16px;color:#fff;">ESTADO DEL SERVIDOR</h4>
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(240px, 1fr));gap:12px;font-size:13px;">
          <div style="color:#94a3b8;">
            Plataforma: <strong style="color:#fff;">Node.js Express + Car Audio Pioneer Engine</strong>
          </div>
          <div style="color:#94a3b8;">
            Presencia en Tiempo Real: <strong style="color:#34d399;">Activa (Heartbeat 5s)</strong>
          </div>
          <div style="color:#94a3b8;">
            Almacenamiento de Admins: <strong style="color:#fff;">data/admins.json</strong>
          </div>
          <div style="color:#94a3b8;">
            Protocolo de Audio: <strong style="color:#38bdf8;">HTML5 Media + Web Audio API</strong>
          </div>
        </div>
      </div>
    `;

    loadStatsData();
  }

  function loadStatsData() {
    fetch('/api/admin/stats')
      .then((res) => res.json())
      .then((data) => {
        const uNow = document.getElementById('statLiveUsersCount');
        const uPeak = document.getElementById('statMaxPeakCount');
        const sUptime = document.getElementById('statServerUptime');
        const sAdmins = document.getElementById('statAdminsCount');

        if (uNow) uNow.textContent = data.onlineUsers;
        if (uPeak) uPeak.textContent = data.peakUsers;
        if (sAdmins) sAdmins.textContent = data.adminCount;

        if (sUptime) {
          const hours = Math.floor(data.uptimeSeconds / 3600);
          const minutes = Math.floor((data.uptimeSeconds % 3600) / 60);
          const seconds = data.uptimeSeconds % 60;
          sUptime.textContent = `${hours}h ${minutes}m ${seconds}s`;
        }
      })
      .catch(() => {});
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Inicializar UI al cargar el DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectAdminUI);
  } else {
    injectAdminUI();
  }
})();
