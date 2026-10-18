import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));

// Ensure data folder and admins.json exist
const DATA_DIR = path.resolve(__dirname, 'data');
const ADMINS_FILE = path.resolve(DATA_DIR, 'admins.json');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(ADMINS_FILE)) {
  const initialAdmins = [
    {
      id: 'admin-1',
      name: 'Administrador Principal',
      username: 'admin',
      password: 'admin123',
      role: 'Super Administrador',
      email: 'admin@musicologos.com',
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
    },
  ];
  fs.writeFileSync(ADMINS_FILE, JSON.stringify(initialAdmins, null, 2));
}

function loadAdmins() {
  try {
    return JSON.parse(fs.readFileSync(ADMINS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function saveAdmins(admins: any[]) {
  fs.writeFileSync(ADMINS_FILE, JSON.stringify(admins, null, 2));
}

// ==========================================
// REAL-TIME PRESENCE & CONNECTED USERS SYSTEM
// ==========================================
export interface ConnectedUser {
  id: string;
  alias: string;
  ip: string;
  userAgent: string;
  device: string;
  browser: string;
  country?: string;
  connectedAt: number;
  lastSeen: number;
  isPlaying: boolean;
  radioModel: string;
  volume: number;
  eqCount: number;
}

const activeSessions = new Map<string, ConnectedUser>();
const broadcastMessages: Array<{ id: string; text: string; sender: string; timestamp: number }> = [];
let peakConnectedUsers = 1;
let totalHistoricalVisits = 0;
const serverStartTime = Date.now();

// Clean up stale sessions (no ping in > 15s)
setInterval(() => {
  const now = Date.now();
  for (const [id, user] of activeSessions.entries()) {
    if (now - user.lastSeen > 15000) {
      activeSessions.delete(id);
    }
  }
  // Keep peak stats
  if (activeSessions.size > peakConnectedUsers) {
    peakConnectedUsers = activeSessions.size;
  }
}, 5000);

// Helper to detect device and browser
function parseUserAgent(ua = '') {
  let device = 'Desktop PC';
  if (/android/i.test(ua)) device = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) device = 'iPhone/iPad';
  else if (/macintosh|mac os x/i.test(ua)) device = 'Mac';
  else if (/windows/i.test(ua)) device = 'Windows';
  else if (/linux/i.test(ua)) device = 'Linux';

  let browser = 'Navegador Web';
  if (/edg/i.test(ua)) browser = 'Edge';
  else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua)) browser = 'Safari';
  else if (/opera|opr/i.test(ua)) browser = 'Opera';

  return { device, browser };
}

// 1. Client Heartbeat Endpoint
app.post('/api/presence/heartbeat', (req, res) => {
  const { id, alias, isPlaying, radioModel, volume, eqCount } = req.body;
  if (!id) {
    res.status(400).json({ error: 'Session ID required' });
    return;
  }

  const rawIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  const cleanIp = rawIp.split(',')[0].trim().replace(/^::ffff:/, '');
  const ua = req.headers['user-agent'] || '';
  const { device, browser } = parseUserAgent(ua);
  const now = Date.now();

  const existing = activeSessions.get(id);
  if (!existing) {
    totalHistoricalVisits++;
    activeSessions.set(id, {
      id,
      alias: alias || `Visitante #${id.slice(-4)}`,
      ip: cleanIp,
      userAgent: ua,
      device,
      browser,
      connectedAt: now,
      lastSeen: now,
      isPlaying: Boolean(isPlaying),
      radioModel: radioModel || 'Pioneer DEH-4250BT',
      volume: typeof volume === 'number' ? volume : 25,
      eqCount: typeof eqCount === 'number' ? eqCount : 1,
    });
  } else {
    existing.lastSeen = now;
    if (alias) existing.alias = alias;
    existing.isPlaying = Boolean(isPlaying);
    if (radioModel) existing.radioModel = radioModel;
    if (typeof volume === 'number') existing.volume = volume;
    if (typeof eqCount === 'number') existing.eqCount = eqCount;
  }

  if (activeSessions.size > peakConnectedUsers) {
    peakConnectedUsers = activeSessions.size;
  }

  // Get unread broadcast messages from last 15 seconds
  const recentMessages = broadcastMessages.filter((m) => now - m.timestamp < 15000);

  res.json({
    success: true,
    onlineCount: activeSessions.size,
    messages: recentMessages,
  });
});

// 2. Get list of online users (for admin panel)
app.get('/api/presence/online', (req, res) => {
  const now = Date.now();
  const users = Array.from(activeSessions.values())
    .filter((u) => now - u.lastSeen <= 15000)
    .map((u) => ({
      ...u,
      onlineDurationSeconds: Math.floor((now - u.connectedAt) / 1000),
      lastPingSecondsAgo: Math.floor((now - u.lastSeen) / 1000),
    }));

  res.json({
    count: users.length,
    peak: peakConnectedUsers,
    totalVisits: totalHistoricalVisits,
    users,
  });
});

// 3. Admin broadcast message to all users
app.post('/api/presence/broadcast', (req, res) => {
  const { text, sender } = req.body;
  if (!text) {
    res.status(400).json({ error: 'Text is required' });
    return;
  }

  const msg = {
    id: `msg-${Date.now()}`,
    text: String(text).trim(),
    sender: sender || 'Administrador',
    timestamp: Date.now(),
  };

  broadcastMessages.push(msg);
  // Keep last 20 messages
  if (broadcastMessages.length > 20) {
    broadcastMessages.shift();
  }

  res.json({ success: true, message: msg });
});

// 4. Disconnect a user
app.post('/api/presence/disconnect', (req, res) => {
  const { id } = req.body;
  if (id && activeSessions.has(id)) {
    activeSessions.delete(id);
  }
  res.json({ success: true });
});

// ==========================================
// ADMIN AUTHENTICATION & MANAGEMENT ENDPOINTS
// ==========================================

// Login
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    return;
  }

  const admins = loadAdmins();
  const admin = admins.find(
    (a: any) =>
      a.username.toLowerCase() === username.trim().toLowerCase() &&
      a.password === password
  );

  if (!admin) {
    res.status(401).json({ error: 'Credenciales inválidas. Verifica usuario y contraseña.' });
    return;
  }

  // Update lastLogin
  admin.lastLogin = new Date().toISOString();
  saveAdmins(admins);

  const safeAdmin = {
    id: admin.id,
    name: admin.name,
    username: admin.username,
    email: admin.email,
    role: admin.role,
    lastLogin: admin.lastLogin,
  };

  res.json({
    success: true,
    token: `adm-token-${admin.id}-${Date.now()}`,
    admin: safeAdmin,
  });
});

// List administrators
app.get('/api/admin/list', (req, res) => {
  const admins = loadAdmins();
  const safeAdmins = admins.map((a: any) => ({
    id: a.id,
    name: a.name,
    username: a.username,
    email: a.email,
    role: a.role,
    createdAt: a.createdAt,
    lastLogin: a.lastLogin,
  }));
  res.json({ success: true, admins: safeAdmins });
});

// Create new administrator
app.post('/api/admin/create', (req, res) => {
  const { name, username, email, password, role } = req.body;

  if (!name || !username || !password) {
    res.status(400).json({ error: 'Nombre, usuario y contraseña son requeridos' });
    return;
  }

  const admins = loadAdmins();
  const cleanUsername = username.trim().toLowerCase();

  if (admins.some((a: any) => a.username.toLowerCase() === cleanUsername)) {
    res.status(400).json({ error: 'El nombre de usuario ya existe. Elige otro.' });
    return;
  }

  const newAdmin = {
    id: `admin-${Date.now()}`,
    name: name.trim(),
    username: cleanUsername,
    password: password.trim(),
    email: (email || '').trim(),
    role: role || 'Administrador',
    createdAt: new Date().toISOString(),
    lastLogin: 'Nunca',
  };

  admins.push(newAdmin);
  saveAdmins(admins);

  res.json({
    success: true,
    admin: {
      id: newAdmin.id,
      name: newAdmin.name,
      username: newAdmin.username,
      email: newAdmin.email,
      role: newAdmin.role,
      createdAt: newAdmin.createdAt,
      lastLogin: newAdmin.lastLogin,
    },
  });
});

// Delete administrator
app.delete('/api/admin/:id', (req, res) => {
  const { id } = req.params;
  const admins = loadAdmins();

  if (admins.length <= 1) {
    res.status(400).json({ error: 'No puedes eliminar al único administrador del sistema.' });
    return;
  }

  const filtered = admins.filter((a: any) => a.id !== id);
  if (filtered.length === admins.length) {
    res.status(404).json({ error: 'Administrador no encontrado.' });
    return;
  }

  saveAdmins(filtered);
  res.json({ success: true });
});

// Server Stats
app.get('/api/admin/stats', (req, res) => {
  const uptimeSeconds = Math.floor((Date.now() - serverStartTime) / 1000);
  const admins = loadAdmins();

  res.json({
    onlineUsers: activeSessions.size,
    peakUsers: peakConnectedUsers,
    totalVisits: totalHistoricalVisits,
    adminCount: admins.length,
    uptimeSeconds,
    serverStartTime: new Date(serverStartTime).toISOString(),
    memoryUsage: process.memoryUsage(),
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    onlineUsers: activeSessions.size,
  });
});

// AI Station & Logo Identity Generator (fallback feature)
app.post('/api/generate-station', async (req, res) => {
  try {
    const { prompt, style } = req.body;
    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({ error: 'Prompt is required' });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(503).json({ error: 'GEMINI_API_KEY is not configured on the server' });
      return;
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [{ role: 'user', parts: [{ text: `Generate radio brand JSON for: ${prompt}` }] }],
      config: { responseMimeType: 'application/json' },
    });

    res.json({ success: true, data: JSON.parse(response.text || '{}') });
  } catch {
    res.json({
      success: true,
      data: {
        name: 'PIONEER DEH-4250BT',
        callSign: 'RADIO MUSICOLOGOS',
        frequency: 104.5,
        band: 'FM',
        slogan: 'Calidad de Audio de Alto Poder',
        genre: 'Musica Urbana, Dembow & Car Audio',
        era: 'Modern Pioneer',
      },
    });
  }
});

// Serve static assets from public folder
app.use(express.static(path.resolve(__dirname, 'public')));

// Vite middleware in development, static in production
if (process.env.NODE_ENV !== 'production') {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Radio Musicologos server listening on port ${PORT}`);
});
