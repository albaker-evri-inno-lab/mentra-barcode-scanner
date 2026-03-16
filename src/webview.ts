import { AuthenticatedRequest, AppServer, AppSession } from '@mentra/sdk';
import express from 'express';
import path from 'path';
import { getScans, addScan } from './scan-history';
import { handleToolCall } from './tools';

/**
 * Sets up all Express routes and middleware for the server
 * @param server The server instance
 */
export function setupExpressRoutes(
  server: AppServer,
  getSession: (userId: string) => AppSession | undefined
): void {
  const app = server.getExpressApp();

  app.set('view engine', 'ejs');
  app.engine('ejs', require('ejs').__express);
  app.set('views', path.join(__dirname, 'views'));

  // Register a route for handling webview requests
  app.get('/webview', (req, res) => {
    const authReq = req as AuthenticatedRequest;
    // Fall back to query param for local browser testing (remove before production)
    const userId = authReq.authUserId || (req.query.userId as string);

    console.log('webview authUserId:', authReq.authUserId);
    console.log('webview resolved userId:', userId);
    console.log('webview headers:', JSON.stringify(req.headers, null, 2));

    if (userId) {
      res.render('webview', {
        userId,
        scans: getScans(userId),
      });
    } else {
      res.render('webview', {
        userId: undefined,
        scans: [],
      });
    }
  });

  // Scan trigger endpoint — called by the webview button
  app.post('/api/scan', async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.authUserId || (req.query.userId as string);

    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const session = getSession(userId);
    if (!session) {
      res.status(404).json({ error: 'No active session — make sure the app is running on your glasses' });
      return;
    }

    const result = await handleToolCall(
      { toolId: 'scan_barcode', userId, timestamp: new Date().toISOString(), toolParameters: {} } as any,
      userId,
      session
    );

    res.json({ result, scans: getScans(userId) });
  });
}
