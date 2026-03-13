import { AuthenticatedRequest, AppServer } from '@mentra/sdk';
import express from 'express';
import path from 'path';
import { getScans } from './scan-history';

/**
 * Sets up all Express routes and middleware for the server
 * @param server The server instance
 */
export function setupExpressRoutes(server: AppServer): void {
  // Get the Express app instance
  const app = server.getExpressApp();

  // Set up EJS as the view engine
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
}
