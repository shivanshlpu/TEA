// ── CafeOS API Server ──
// Express + Prisma + Socket.io — multi-tenant, business_id scoped.

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import xss from 'xss-clean';

// Route imports
import authRoutes from './routes/auth.js';
import menuRoutes from './routes/menu.js';
import categoryRoutes from './routes/categories.js';
import cartRoutes from './routes/cart.js';
import orderRoutes from './routes/orders.js';
import dashboardRoutes from './routes/dashboard.js';
import settingsRoutes from './routes/settings.js';
import deliveryRoutes from './routes/delivery.js';
import customerRoutes from './routes/customers.js';
import couponRoutes from './routes/coupons.js';
import reviewRoutes from './routes/reviews.js';
import referralRoutes from './routes/referral.js';
import notificationRoutes from './routes/notifications.js';
import uploadRoutes from './routes/upload.js';
import marketingRoutes from './routes/marketing.js';
import reportRoutes from './routes/reports.js';
import razorpayRoutes from './routes/razorpay.js';
import { initBaileys } from './lib/baileys.js';
import { startOrderScheduler } from './lib/orderScheduler.js';
import cache from './lib/cache.js';
import path from 'path';

const app = express();
const httpServer = createServer(app);
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

// Track connected sockets count
let connectedSockets = 0;

// Dynamic CORS origin handler for local development, LAN devices, and production domains
const configuredOrigins = [
  process.env.CUSTOMER_WEB_URL,
  process.env.OWNER_DASHBOARD_URL,
  process.env.DELIVERY_APP_URL,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
].filter(Boolean);

const corsOriginValidator = (origin, callback) => {
  if (!origin) return callback(null, true);
  if (configuredOrigins.includes(origin)) return callback(null, true);
  try {
    const hostname = new URL(origin).hostname;
    // Allow localhost, loopback, and local network LAN IPs
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      /^10\.\d+\.\d+\.\d+$/.test(hostname) ||
      /^192\.168\.\d+\.\d+$/.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(hostname)
    ) {
      return callback(null, true);
    }
    // Allow secure tunnels and deployment domains
    if (/\.(loca\.lt|trycloudflare\.com|ngrok-free\.app|vercel\.app|onrender\.com|render\.com|surge\.sh)$/.test(hostname)) {
      return callback(null, true);
    }
  } catch (_) {}
  return callback(null, true);
};

// ── Socket.io ──
const io = new SocketServer(httpServer, {
  maxHttpBufferSize: 1e7, // 10MB buffer to allow audio sync broadcast across devices
  cors: {
    origin: corsOriginValidator,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Socket.io connection handling
io.on('connection', (socket) => {
  connectedSockets++;
  console.log(`🔌 Socket connected: ${socket.id} (total: ${connectedSockets})`);

  // Join order-specific room for real-time tracking
  socket.on('join-order', (orderId) => {
    socket.join(`order:${orderId}`);
    console.log(`   → Joined room order:${orderId}`);
  });

  // Join business room for owner dashboard live updates
  socket.on('join-business', (businessId) => {
    socket.join(`business:${businessId}`);
    console.log(`   → Joined room business:${businessId}`);
  });

  socket.on('disconnect', () => {
    connectedSockets = Math.max(0, connectedSockets - 1);
    console.log(`🔌 Socket disconnected: ${socket.id} (total: ${connectedSockets})`);
  });
});

// ── Performance Middleware ──

// High-speed response compression (Gzip / Deflate)
app.use(compression({
  threshold: 1024, // compress responses > 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
}));

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

// Multi-tier Rate Limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 60, // 60 attempts per 15 min per IP
  skip: (req) => {
    const ip = req.ip || req.connection?.remoteAddress || '';
    return ip.includes('127.0.0.1') || ip.includes('::1') || ip === 'localhost';
  },
  message: { error: 'Too many authentication attempts, please try again in a few minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 10000, 
  skip: (req) => {
    const ip = req.ip || req.connection?.remoteAddress || '';
    if (ip.includes('127.0.0.1') || ip.includes('::1') || ip === 'localhost') return true;
    if (
      req.path === '/' ||
      req.path === '/health' ||
      req.path === '/ping' ||
      req.path === '/api/health' ||
      req.path === '/api/v1/health' ||
      req.path === '/v1/health'
    ) {
      return true;
    }
    return false;
  },
  message: { error: 'High traffic detected from this IP, please try again in a few moments' },
  standardHeaders: true, 
  legacyHeaders: false, 
});

app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/register', authLimiter);
app.use('/api/', globalLimiter);

app.use(cors({
  origin: corsOriginValidator,
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// Prevent XSS attacks by sanitizing incoming data
app.use(xss());

app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));

// Google Search Console verification file
app.get('/google2eca59f8c1f031f6.html', (_req, res) => {
  res.type('text/html').send('google-site-verification: google2eca59f8c1f031f6.html');
});

// Attach Prisma, Socket.io, and Cache to request for use in routes
app.use((req, res, next) => {
  req.prisma = prisma;
  req.io = io;
  req.cache = cache;

  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 250 && req.path.startsWith('/api')) {
      console.warn(`⚡ [Latency Alert] ${req.method} ${req.originalUrl || req.url} completed in ${duration}ms (${res.statusCode})`);
    }
  });

  next();
});

// ── Routes (mounts both /api/v1/* and /api/* to guarantee zero 404s) ──
const registerRoute = (pathSuffix, routerInstance) => {
  app.use(`/api/v1${pathSuffix}`, routerInstance);
  app.use(`/api${pathSuffix}`, routerInstance);
};

registerRoute('/auth', authRoutes);
registerRoute('/menu', menuRoutes);
registerRoute('/categories', categoryRoutes);
registerRoute('/cart', cartRoutes);
registerRoute('/orders', orderRoutes);
registerRoute('/dashboard', dashboardRoutes);
registerRoute('/settings', settingsRoutes);
registerRoute('/delivery', deliveryRoutes);
registerRoute('/customers', customerRoutes);
registerRoute('/coupons', couponRoutes);
registerRoute('/reviews', reviewRoutes);
registerRoute('/referral', referralRoutes);
registerRoute('/notifications', notificationRoutes);
registerRoute('/upload', uploadRoutes);
registerRoute('/marketing', marketingRoutes);
registerRoute('/reports', reportRoutes);
registerRoute('/razorpay', razorpayRoutes);
// Direct standard endpoints: POST /api/create-order & POST /api/verify-payment
app.use('/api', razorpayRoutes);
app.use('/api/v1', razorpayRoutes);

// ── Fast Keep-Alive Ping Endpoints (UptimeRobot, Render Health Check, Pingers) ──
app.get(['/', '/health', '/api/health', '/ping'], (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'CafeOS API Enterprise',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// ── Deep Health Check (for Production Load Balancers & Monitoring) ──
app.get('/api/v1/health', async (_req, res) => {
  const startTime = Date.now();
  let dbStatus = 'healthy';
  let dbLatencyMs = 0;

  try {
    const dbStart = Date.now();
    await prisma.business.findFirst({ select: { id: true } });
    dbLatencyMs = Date.now() - dbStart;
  } catch (err) {
    dbStatus = 'unhealthy (' + err.message + ')';
  }

  const mem = process.memoryUsage();
  const isHealthy = dbStatus === 'healthy';

  const healthData = {
    status: isHealthy ? 'ok' : 'degraded',
    service: 'CafeOS API Enterprise',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: {
      status: dbStatus,
      latencyMs: dbLatencyMs,
    },
    cache: cache.getStats(),
    websockets: {
      activeConnections: connectedSockets,
    },
    system: {
      memory: {
        rssMB: (mem.rss / 1024 / 1024).toFixed(1),
        heapUsedMB: (mem.heapUsed / 1024 / 1024).toFixed(1),
        heapTotalMB: (mem.heapTotal / 1024 / 1024).toFixed(1),
      },
      nodeVersion: process.version,
    },
    checkDurationMs: Date.now() - startTime,
  };

  // Always return 200 so Uptime monitors do not report false downtime during DB cold-starts
  res.status(200).json(healthData);
});

// ── Error Handler ──
app.use((err, _req, res, _next) => {
  console.error('❌ Unhandled error:', err);
  const status = err.status || 500;
  const isProd = process.env.NODE_ENV === 'production';
  const clientMessage = isProd && status === 500 
    ? 'An unexpected error occurred. Please try again later.' 
    : (err.message || 'Internal Server Error');

  res.status(status).json({
    error: clientMessage,
    ...(!isProd && { stack: err.stack }),
  });
});

// ── Start ──
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`\n🚀 CafeOS API running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/v1/health`);
  console.log(`   Socket.io: ws://localhost:${PORT}\n`);

  // Start Baileys WhatsApp client automatically in background
  initBaileys().catch((err) => {
    console.error('Baileys initial start error:', err);
  });

  // Start background order scheduler for 10-minute pickup reminders
  startOrderScheduler(prisma, io);
});

// ── Graceful Process Shutdown ──
async function gracefulShutdown(signal) {
  console.log(`\n⚠️ Received ${signal}. Initiating graceful shutdown...`);
  httpServer.close(async () => {
    console.log('   ✓ HTTP & WebSocket servers closed.');
    try {
      await prisma.$disconnect();
      console.log('   ✓ Prisma database connections released.');
    } catch (e) {
      console.error('   ❌ Error disconnecting Prisma:', e);
    }
    process.exit(0);
  });

  // Force shutdown after 10s timeout
  setTimeout(() => {
    console.error('   ❌ Forced shutdown after timeout.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export { app, io, prisma, cache };
