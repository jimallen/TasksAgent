interface OAuthResponse {
  code?: string;
  error?: string;
}

export class OAuthServer {
  private server: any = null;
  private port = 3000;
  private authCodePromise: Promise<string> | null = null;
  private authCodeResolve: ((code: string) => void) | null = null;
  private authCodeReject: ((error: Error) => void) | null = null;

  constructor() {}

  async start(): Promise<void> {
    if (this.server) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        // Use Node.js http module available in Electron
        const http = (window as any).require('http');

        this.server = http.createServer((req: any, res: any) => {
          const url = new URL(req.url, `http://localhost:${this.port}`);

          if (url.pathname === '/callback') {
            const code = url.searchParams.get('code');
            const error = url.searchParams.get('error');

            res.writeHead(200, { 'Content-Type': 'text/html' });

            if (code) {
              res.end(`
                <!DOCTYPE html>
                <html>
                <head>
                  <title>Authentication Successful</title>
                  <style>
                    body {
                      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                      display: flex;
                      justify-content: center;
                      align-items: center;
                      min-height: 100vh;
                      margin: 0;
                      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                      color: white;
                    }
                    .container {
                      text-align: center;
                      padding: 2rem;
                      background: rgba(255, 255, 255, 0.1);
                      border-radius: 12px;
                      backdrop-filter: blur(10px);
                    }
                    .success-icon {
                      font-size: 4rem;
                      margin-bottom: 1rem;
                    }
                    h1 {
                      margin: 0 0 0.5rem 0;
                      font-size: 2rem;
                    }
                    p {
                      margin: 0.5rem 0;
                      opacity: 0.9;
                      font-size: 1.1rem;
                    }
                    .close-hint {
                      margin-top: 2rem;
                      font-size: 0.9rem;
                      opacity: 0.7;
                    }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <div class="success-icon">✅</div>
                    <h1>Authentication Successful!</h1>
                    <p>You can now close this window and return to Obsidian.</p>
                    <p class="close-hint">This window will close automatically in 3 seconds...</p>
                  </div>
                  <script>
                    setTimeout(() => window.close(), 3000);
                  </script>
                </body>
                </html>
              `);

              if (this.authCodeResolve) {
                this.authCodeResolve(code);
                this.authCodeResolve = null;
                this.authCodeReject = null;
              }
            } else {
              res.end(`
                <!DOCTYPE html>
                <html>
                <head>
                  <title>Authentication Failed</title>
                  <style>
                    body {
                      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                      display: flex;
                      justify-content: center;
                      align-items: center;
                      min-height: 100vh;
                      margin: 0;
                      background: linear-gradient(135deg, #f5576c 0%, #f093fb 100%);
                      color: white;
                    }
                    .container {
                      text-align: center;
                      padding: 2rem;
                      background: rgba(255, 255, 255, 0.1);
                      border-radius: 12px;
                      backdrop-filter: blur(10px);
                    }
                    .error-icon {
                      font-size: 4rem;
                      margin-bottom: 1rem;
                    }
                    h1 {
                      margin: 0 0 0.5rem 0;
                      font-size: 2rem;
                    }
                    p {
                      margin: 0.5rem 0;
                      opacity: 0.9;
                    }
                    .error-msg {
                      margin-top: 1rem;
                      padding: 1rem;
                      background: rgba(0, 0, 0, 0.2);
                      border-radius: 6px;
                      font-family: monospace;
                      font-size: 0.9rem;
                    }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <div class="error-icon">❌</div>
                    <h1>Authentication Failed</h1>
                    <p>There was an error during authentication.</p>
                    ${error ? `<div class="error-msg">Error: ${error}</div>` : ''}
                    <p>Please close this window and try again.</p>
                  </div>
                </body>
                </html>
              `);

              if (this.authCodeReject) {
                this.authCodeReject(new Error(error || 'Authentication failed'));
                this.authCodeResolve = null;
                this.authCodeReject = null;
              }
            }
          } else {
            res.writeHead(404);
            res.end('Not found');
          }
        });

        this.server.listen(this.port, '127.0.0.1', () => {
          console.log(`[OAuth Server] Started on http://127.0.0.1:${this.port}`);
          resolve();
        });

        this.server.on('error', (err: any) => {
          if (err.code === 'EADDRINUSE') {
            console.error(`[OAuth Server] Port ${this.port} is already in use`);
            reject(new Error(`Port ${this.port} is already in use. Please close any other applications using this port.`));
          } else {
            reject(err);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async stop(): Promise<void> {
    // Clear any pending timeouts
    if ((this as any).timeoutId) {
      clearTimeout((this as any).timeoutId);
      (this as any).timeoutId = null;
    }

    // Clear any pending promises
    this.authCodeResolve = null;
    this.authCodeReject = null;
    this.authCodePromise = null;

    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          console.log('[OAuth Server] Stopped');
          this.server = null;
          resolve();
        });
      });
    }
  }

  async waitForAuthCode(): Promise<string> {
    if (!this.server) {
      throw new Error('OAuth server not started');
    }

    // Clear any existing promises
    this.authCodeResolve = null;
    this.authCodeReject = null;
    this.authCodePromise = null;

    this.authCodePromise = new Promise<string>((resolve, reject) => {
      this.authCodeResolve = resolve;
      this.authCodeReject = reject;

      const timeoutId = setTimeout(() => {
        this.authCodeResolve = null;
        this.authCodeReject = null;
        reject(new Error('OAuth timeout - no response received within 5 minutes'));
      }, 5 * 60 * 1000);

      // Store timeout ID for cleanup if needed
      (this as any).timeoutId = timeoutId;
    });

    return this.authCodePromise;
  }

  getRedirectUri(): string {
    return `http://127.0.0.1:${this.port}/callback`;
  }

  isRunning(): boolean {
    return this.server !== null;
  }
}