import type { Request, Response } from 'express';
import { checkSupabaseConnection } from '../../src/server/supabase.ts';

export default async function handler(req: Request, res: Response) {
  res.setHeader('Content-Type', 'application/json');

  try {
    const status = await checkSupabaseConnection();
    return res.status(200).json(status);
  } catch (err: any) {
    console.error('Error in /api/supabase/status handler:', err);
    return res.status(200).json({
      configured: false,
      connected: false,
      tablesReady: false,
      error: err?.message || 'Connection check failed',
    });
  }
}
