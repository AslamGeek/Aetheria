import type { Request, Response } from 'express';
import { checkSupabaseConnection, saveSupabaseCredentials } from '../../src/server/supabase.ts';

export default async function handler(req: Request, res: Response) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const url = body.url;
    const key = body.key || body.serviceKey || body.anonKey;

    if (!url || !key) {
      return res.status(400).json({ error: 'Both url and key (serviceKey or anonKey) are required' });
    }

    saveSupabaseCredentials(url, key);
    const status = await checkSupabaseConnection();

    return res.status(200).json({
      success: true,
      status,
    });
  } catch (err: any) {
    console.error('Error in /api/supabase/config handler:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to configure Supabase credentials',
    });
  }
}
