import express from 'express';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import authRoutes from './src/server/authRoutes';
import oauthRoutes from './src/server/oauthRoutes';
import { verifyOrigin } from './src/server/originCheck';

dotenv.config();

const PORT = 3000;

async function startServer() {
  const app = express();

  // Parse JSON, URL-encoded bodies and cookies
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Security headers & Origin check for mutations
  app.use(verifyOrigin);

  // Mount API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/oauth', oauthRoutes);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Serve frontend with Vite in development or static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Clarity server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Clarity server:', err);
  process.exit(1);
});
