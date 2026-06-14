import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import apiApp from './api';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Mount the extracted API router
  app.use(apiApp);

  // Serve app resources and handle development vs production environments
  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Clever NVIDIA AI Server is matching requests on port ${PORT}`);
  });
}

startServer();

