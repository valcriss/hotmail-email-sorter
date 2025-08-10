import 'dotenv/config';
import { PublicClientApplication, ConfidentialClientApplication } from '@azure/msal-node';
import { Client } from '@microsoft/microsoft-graph-client';
import type { AuthenticationProvider } from '@microsoft/microsoft-graph-client';
import * as http from 'http';
import * as url from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import { convert as htmlToText } from 'html-to-text';
import 'isomorphic-fetch';
import { logger } from './logger.js';

const execAsync = promisify(exec);

function getRequiredEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    const message = `Environment variable ${name} is required`;
    logger.error(message);
    throw new Error(message);
  }
  return value;
}

interface GraphEmail {
  id: string;
  subject: string;
  from: {
    emailAddress: {
      address: string;
      name: string;
    };
  };
  bodyPreview: string;
  body: {
    contentType: string;
    content: string;
  };
  isRead: boolean;
  parentFolderId: string;
}

interface GraphFolder {
  id: string;
  displayName: string;
}

class MSALAuthenticationProvider implements AuthenticationProvider {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  async getAccessToken(): Promise<string> {
    return this.accessToken;
  }
}

export class MicrosoftGraphClient {
  private msalConfig = {
    auth: {
      clientId: getRequiredEnvVar('MICROSOFT_CLIENT_ID'),
      authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID || 'consumers'}`,
      ...(process.env.MICROSOFT_CLIENT_SECRET && {
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET
      })
    },
  };

  private pca: PublicClientApplication | ConfidentialClientApplication;
  private graphClient?: Client;
  private folderCache: Map<string, string> = new Map(); // Cache pour les IDs de dossiers

  constructor() {
    // Use ConfidentialClientApplication if client secret provided, otherwise PublicClientApplication
    if (process.env.MICROSOFT_CLIENT_SECRET) {
      logger.debug('Using ConfidentialClientApplication with client secret');
      this.pca = new ConfidentialClientApplication(this.msalConfig);
    } else {
      logger.debug('Using PublicClientApplication without client secret');
      this.pca = new PublicClientApplication(this.msalConfig);
    }
  }

  async authenticate(): Promise<void> {
    const PORT = 8080;
    const redirectUri = process.env.MICROSOFT_REDIRECT_URI || `http://localhost:${PORT}/callback`;
    
    // Demande d'autorisation
    const authCodeUrlParameters = {
      scopes: ['https://graph.microsoft.com/Mail.Read', 'https://graph.microsoft.com/Mail.ReadWrite', 'offline_access'],
      redirectUri: redirectUri,
    };

    const authUrl = await this.pca.getAuthCodeUrl(authCodeUrlParameters);
    
    logger.info('🌐 Open this link in your browser to sign in:');
    logger.info(authUrl);
    logger.info('\n⏳ Waiting for authorization...');

    // Open browser automatically
    try {
      await this.openBrowser(authUrl);
      logger.debug('Browser opened automatically');
    } catch (error) {
      logger.debug('Automatic opening failed, use the link above');
    }

    // Serveur temporaire pour recevoir le code d'autorisation
    const authCode = await this.startLocalServer(PORT);
    
    // Échange du code contre un token
    const tokenRequest = {
      code: authCode,
      scopes: ['https://graph.microsoft.com/Mail.Read', 'https://graph.microsoft.com/Mail.ReadWrite', 'offline_access'],
      redirectUri: redirectUri,
    };

    const response = await this.pca.acquireTokenByCode(tokenRequest);
    
    if (!response?.accessToken) {
      throw new Error('Unable to obtain access token');
    }

    // Initialize Graph client
    const authProvider = new MSALAuthenticationProvider(response.accessToken);
    this.graphClient = Client.initWithMiddleware({ authProvider });
    
    logger.success('Authentication successful!');
  }

  private startLocalServer(port: number, timeoutMs: number = 120000): Promise<string> {
    return new Promise((resolve, reject) => {
      let timeoutId: NodeJS.Timeout;
      const server = http.createServer((req, res) => {
        logger.debug(`Request received: ${req.method} ${req.url}`);
        
        // Ignore parasitic requests
        if (req.url?.includes('favicon') || req.url?.includes('service-worker')) {
          res.writeHead(404);
          res.end();
          return;
        }

        const parsedUrl = url.parse(req.url!, true);
        
        if (parsedUrl.pathname === '/callback') {
          const code = parsedUrl.query.code as string;
          const error = parsedUrl.query.error as string;
          const errorDescription = parsedUrl.query.error_description as string;
          
          logger.debug('Parameters received:', { code: code ? 'PRESENT' : 'MISSING', error, errorDescription });
          
          if (error) {
            logger.error(`OAuth Error: ${error} - ${errorDescription}`);
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
              <html>
                <body style="font-family: Arial; padding: 20px;">
                  <h1>❌ Authentication Error</h1>
                  <p><strong>Error:</strong> ${error}</p>
                  <p><strong>Description:</strong> ${errorDescription || 'No description'}</p>
                  <p>Return to the terminal and restart the process.</p>
                  <script>setTimeout(() => window.close(), 5000);</script>
                </body>
              </html>
            `);
            clearTimeout(timeoutId);
            server.close();
            reject(new Error(`OAuth Error: ${error} - ${errorDescription}`));
            return;
          }

          if (code) {
            logger.debug(`Authorization code received: ${code.substring(0, 10)}...`);
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
              <html>
                <body style="font-family: Arial; padding: 20px; text-align: center;">
                  <h1>✅ Authentication Successful!</h1>
                  <p>You can close this window and return to the terminal.</p>
                  <p><small>Code received: ${code.substring(0, 15)}...</small></p>
                  <script>
                    setTimeout(() => window.close(), 3000);
                  </script>
                </body>
              </html>
            `);
            clearTimeout(timeoutId);
            server.close();
            resolve(code);
          } else {
            logger.error('No authorization code in request');
            logger.debug('Complete URL:', req.url);
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
              <html>
                <body style="font-family: Arial; padding: 20px;">
                  <h1>❌ Missing Authorization Code</h1>
                  <p>The request does not contain an authorization code.</p>
                  <p>URL received: <code>${req.url}</code></p>
                  <p>Check your Azure app configuration.</p>
                  <script>setTimeout(() => window.close(), 5000);</script>
                </body>
              </html>
            `);
            // Don't close server immediately to allow seeing the error
            setTimeout(() => {
              clearTimeout(timeoutId);
              server.close();
              reject(new Error('Missing authorization code'));
            }, 2000);
          }
        } else if (parsedUrl.pathname === '/' || parsedUrl.pathname === '/auth') {
          // Help page if user goes directly to localhost:8080
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <html>
              <body style="font-family: Arial; padding: 20px;">
                <h1>🔐 Microsoft Graph Authentication Server</h1>
                <p>This server is waiting for a Microsoft authentication callback.</p>
                <p>If you see this page, authentication has not yet occurred.</p>
                <p><strong>Instructions:</strong></p>
                <ol>
                  <li>Close this window</li>
                  <li>Return to the terminal</li>
                  <li>Click on the Microsoft authentication link</li>
                </ol>
              </body>
            </html>
          `);
        } else {
          res.writeHead(404);
          res.end('Page not found');
        }
      });

      server.listen(port, () => {
        logger.debug(`Authentication server started on port ${port}`);
      });

      // Security timeout
      timeoutId = setTimeout(() => {
        logger.warn('2-minute timeout reached');
        server.close();
        reject(new Error('Authentication timeout'));
      }, timeoutMs); // Default 2 minutes

      server.on('error', (error) => {
        logger.error('Server error:', error);
        clearTimeout(timeoutId);
        server.close();
        reject(error);
      });
    });
  }

  async getUnreadEmails(limit: number = 50): Promise<GraphEmail[]> {
    if (!this.graphClient) {
      throw new Error('Client not authenticated. Call authenticate() first.');
    }

    try {
      // Retrieve only emails from the inbox
      const messages = await this.graphClient
        .api('/me/mailFolders/inbox/messages')
        .filter('isRead eq false')
        .select('id,subject,from,bodyPreview,body,isRead,parentFolderId')
        .top(limit)
        .orderby('receivedDateTime desc') // Most recent first
        .get();

      return messages.value || [];
    } catch (error) {
      logger.error('Error retrieving emails from inbox:', error);
      throw error;
    }
  }

  async getAllInboxEmails(limit: number = 20): Promise<GraphEmail[]> {
    if (!this.graphClient) {
      throw new Error('Client not authenticated. Call authenticate() first.');
    }

    try {
      // Retrieve ALL emails from inbox (read and unread)
      const messages = await this.graphClient
        .api('/me/mailFolders/inbox/messages')
        .select('id,subject,from,bodyPreview,body,isRead,parentFolderId')
        .top(limit)
        .orderby('receivedDateTime desc') // Most recent first
        .get();

      return messages.value || [];
    } catch (error) {
      logger.error('Error retrieving all emails from inbox:', error);
      throw error;
    }
  }

  async getFolders(): Promise<GraphFolder[]> {
    if (!this.graphClient) {
      throw new Error('Client not authenticated');
    }

    try {
      const folders = await this.graphClient
        .api('/me/mailFolders')
        .select('id,displayName')
        .get();

      return folders.value || [];
    } catch (error) {
      logger.error('Error retrieving folders:', error);
      throw error;
    }
  }

  async getInboxId(): Promise<string> {
    if (!this.graphClient) {
      throw new Error('Client not authenticated');
    }

    try {
      // Retrieve inbox
      const inbox = await this.graphClient
        .api('/me/mailFolders/inbox')
        .select('id')
        .get();

      return inbox.id;
    } catch (error) {
      logger.error('Error retrieving inbox:', error);
      throw error;
    }
  }

  async getInboxSubfolders(): Promise<GraphFolder[]> {
    if (!this.graphClient) {
      throw new Error('Client not authenticated');
    }

    try {
      const inboxId = await this.getInboxId();
      const folders = await this.graphClient
        .api(`/me/mailFolders/${inboxId}/childFolders`)
        .select('id,displayName')
        .get();

      const subfolders = folders.value || [];
      // Simplified log - only in debug mode if necessary
      logger.debug(`Inbox subfolders found: ${subfolders.map((f: GraphFolder) => f.displayName).join(', ')}`);
      return subfolders;
    } catch (error) {
      logger.error('Error retrieving inbox subfolders:', error);
      throw error;
    }
  }

  async debugListAllFolders(): Promise<void> {
    try {
      logger.debug('DEBUG: Listing all folders...');
      
      // All root folders
      const allFolders = await this.getFolders();
      logger.debug('Root folders:');
      allFolders.forEach((folder: GraphFolder) => {
        logger.debug(`  - ${folder.displayName} (ID: ${folder.id})`);
      });
      
      // Inbox subfolders
      const inboxSubfolders = await this.getInboxSubfolders();
      logger.debug('Inbox subfolders:');
      inboxSubfolders.forEach((folder: GraphFolder) => {
        logger.debug(`  - ${folder.displayName} (ID: ${folder.id})`);
      });
      
    } catch (error) {
      logger.error('Error during folder debug:', error);
    }
  }

  async createFolder(name: string): Promise<string> {
    if (!this.graphClient) {
      throw new Error('Client not authenticated');
    }
    // Escape single quotes for OData filter
    const filterName = name.replace(/'/g, "''");

    try {
      // Check if folder already exists anywhere
      const existing = await this.graphClient
        .api(`/me/mailFolders?$filter=displayName eq '${filterName}'`)
        .select('id,displayName')
        .get();

      if (existing?.value && existing.value.length > 0) {
        return existing.value[0].id;
      }

      // Create folder as subfolder of inbox
      const inboxId = await this.getInboxId();
      const folder = await this.graphClient
        .api(`/me/mailFolders/${inboxId}/childFolders`)
        .post({
          displayName: name
        });

      return folder.id;
    } catch (error) {
      logger.error('Error creating or retrieving folder:', error);
      throw error;
    }
  }

  async moveEmail(emailId: string, folderId: string): Promise<void> {
    if (!this.graphClient) {
      throw new Error('Client not authenticated');
    }

    try {
      await this.graphClient
        .api(`/me/messages/${emailId}/move`)
        .post({
          destinationId: folderId
        });
      logger.debug(`Email moved: ${emailId.slice(-8)}`);
    } catch (error: any) {
      if (error?.code === 'ErrorItemNotFound') {
        logger.warn(`Email not found: ${emailId.slice(-8)}`);
        return; // Don't throw error if email no longer exists
      }
      logger.error(`Move error ${emailId.slice(-8)}`);
      throw error;
    }
  }

  async markAsRead(emailId: string): Promise<void> {
    if (!this.graphClient) {
      throw new Error('Client not authenticated');
    }

    try {
      await this.graphClient
        .api(`/me/messages/${emailId}`)
        .patch({
          isRead: true
        });
      logger.debug(`Email marked as read: ${emailId.slice(-8)}`);
    } catch (error: any) {
      if (error?.code === 'ErrorItemNotFound') {
        logger.warn(`Email not found: ${emailId.slice(-8)}`);
        return; // Don't throw error if email no longer exists
      }
      logger.error(`Mark as read error ${emailId.slice(-8)}`);
      throw error;
    }
  }

  async emailExists(emailId: string): Promise<boolean> {
    if (!this.graphClient) {
      throw new Error('Client not authenticated');
    }

    try {
      await this.graphClient
        .api(`/me/messages/${emailId}`)
        .select('id')
        .get();
      return true;
    } catch (error: any) {
      if (error?.code === 'ErrorItemNotFound') {
        return false;
      }
      throw error;
    }
  }

  async ensureFolder(name: string): Promise<string> {
    const key = name.trim().toLowerCase();

    // Check cache first
    if (this.folderCache.has(key)) {
      return this.folderCache.get(key)!;
    }

    try {
      // 1. First search in inbox subfolders
      const inboxSubfolders = await this.getInboxSubfolders();
      const existingInboxFolder = inboxSubfolders.find(
        f => f.displayName.trim().toLowerCase() === key
      );

      if (existingInboxFolder) {
        logger.debug(`Folder found: ${name}`);
        this.folderCache.set(key, existingInboxFolder.id);
        return existingInboxFolder.id;
      }

      // 2. Then search in all folders (root) in case it exists there
      const allFolders = await this.getFolders();
      const existingRootFolder = allFolders.find(
        f => f.displayName.trim().toLowerCase() === key
      );

      if (existingRootFolder) {
        logger.debug(`Folder found (root): ${name}`);
        this.folderCache.set(key, existingRootFolder.id);
        return existingRootFolder.id;
      }

      // 3. Create folder as inbox subfolder
      const folderId = await this.createFolder(name);
      logger.debug(`Folder created: ${name}`);
      this.folderCache.set(key, folderId);
      return folderId;
    } catch (error: any) {
      // In case of error, use existing folder as fallback
      logger.warn(`Issue with folder ${name}, attempting fallback`);
      try {
        const inboxSubfolders = await this.getInboxSubfolders();

        // Try to find similar folder
        const fallbackFolder = inboxSubfolders.find(f =>
          f.displayName.trim().toLowerCase().includes(key.substring(0, 4))
        );

        if (fallbackFolder) {
          logger.debug(`Using folder: ${fallbackFolder.displayName}`);
          this.folderCache.set(key, fallbackFolder.id);
          return fallbackFolder.id;
        }

        logger.warn(`No available target folder for ${name}`);
        throw error;

      } catch {
        throw error; // Re-throw original error
      }
    }
  }

  private async openBrowser(url: string): Promise<void> {
    const platform = process.platform;
    let command: string;
    
    switch (platform) {
      case 'darwin':  // macOS
        command = `open "${url}"`;
        break;
      case 'win32':   // Windows
        command = `start "${url}"`;
        break;
      default:        // Linux et autres
        command = `xdg-open "${url}"`;
        break;
    }
    
    await execAsync(command);
  }

  // Converts HTML/text content of an email to readable text
  static convertEmailBodyToText(email: GraphEmail): string {
    if (!email.body || !email.body.content) {
      return email.bodyPreview || '';
    }

    if (email.body.contentType === 'html') {
      try {
        const textContent = htmlToText(email.body.content, {
          wordwrap: 130,
          limits: {
            maxInputLength: 16384, // Limit to ~16KB to avoid very long emails
          },
          selectors: [
            // Ignore elements not useful for classification
            { selector: 'img', format: 'skip' },
            { selector: 'style', format: 'skip' },
            { selector: 'script', format: 'skip' },
            { selector: 'meta', format: 'skip' },
            { selector: 'head', format: 'skip' },
            // Keep important links
            { selector: 'a', options: { ignoreHref: true } },
          ],
        });
        
        // Clean text (remove excessive empty lines, etc.)
        return textContent
          .replace(/\n\s*\n\s*\n/g, '\n\n') // Reduce multiple empty lines
          .replace(/\s+/g, ' ') // Reduce multiple spaces
          .trim()
          .substring(0, 2000); // Limit to 2000 characters for LLM
          
      } catch (error) {
        logger.warn(`Error converting HTML->text for ${email.id.slice(-8)}, using preview`);
        return email.bodyPreview || '';
      }
    } else {
      // Content already in plain text
      return email.body.content.substring(0, 2000);
    }
  }
}

export type { GraphEmail, GraphFolder };
