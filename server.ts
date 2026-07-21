import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- API Routes (Simulated Database for Prototype) ---
  const db = {
    shops: [
      { id: 'S1', name: 'KI3 Main Store', owner: 'Kyaw Zin', plan: '50000 MMK', status: 'Active', expiry: '2026-12-31' },
      { id: 'S2', name: 'Mandalay Branch', owner: 'Aung Aung', plan: '30000 MMK', status: 'Active', expiry: '2026-10-15' },
    ],
    stats: {
      revenue: 4500000,
      totalOrders: 1240,
      activeShops: 42,
    }
  };

  app.get('/api/admin/stats', (req, res) => res.json(db.stats));
  app.get('/api/admin/shops', (req, res) => res.json(db.shops));

  // --- Vite Middleware for Development ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production serving
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`KI3 POS Server running on port ${PORT}`);
  });
}

startServer();
