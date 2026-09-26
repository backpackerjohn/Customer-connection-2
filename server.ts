import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { lookupLenderDirect } from './src/services/lenderLookupService';
import { lookupTradeEquipmentDirect } from './src/services/tradeEquipmentService';
import { lookupEmployerDirect } from './src/services/employerLookupService';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '10mb' }));

// API route: Payoff Lender lookup (runs server-side with Google Search grounding)
app.post('/api/lookup-lender', async (req: Request, res: Response) => {
  const { bank } = req.body || {};
  if (!bank || typeof bank !== 'string' || bank.trim().length < 2) {
    return res.status(400).json({ error: 'type the lender name first' });
  }
  try {
    const result = await lookupLenderDirect(bank.trim());
    return res.json(result);
  } catch (err: unknown) {
    console.error('Server /api/lookup-lender error:', err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
});

// API route: Trade Equipment lookup (runs server-side with Google Search grounding)
app.post('/api/lookup-trade-equipment', async (req: Request, res: Response) => {
  const { input, options } = req.body || {};
  if (!input || !input.year || !input.make || !input.model) {
    return res.status(400).json({ error: 'year, make, and model are required' });
  }
  try {
    const result = await lookupTradeEquipmentDirect(input, options || {});
    return res.json(result);
  } catch (err: unknown) {
    console.error('Server /api/lookup-trade-equipment error:', err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
});

// API route: Employer lookup for the credit application (Places when
// GOOGLE_PLACES_API_KEY is set, otherwise Gemini with Google Search grounding)
app.post('/api/lookup-employer', async (req: Request, res: Response) => {
  const { query, near } = req.body || {};
  if (!query || typeof query !== 'string' || query.trim().length < 2) {
    return res.status(400).json({ error: 'type the employer name first' });
  }
  try {
    const result = await lookupEmployerDirect(query.trim(), near && typeof near === 'object' ? near : {});
    return res.json(result);
  } catch (err: unknown) {
    console.error('Server /api/lookup-employer error:', err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
});

const isProd = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT} (${isProd ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
