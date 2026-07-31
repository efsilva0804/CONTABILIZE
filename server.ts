import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { google } from "googleapis";
import session from "express-session";
import cookieParser from "cookie-parser";

const SCOPES = ["https://www.googleapis.com/auth/drive.file"];

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    // When running locally this must match the authorized redirect URI
    `${process.env.APP_URL || 'http://localhost:3000'}/api/oauth/google/callback`
  );
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());
  
  // Use session to store tokens securely
  app.use(session({
    secret: process.env.SESSION_SECRET || "fallback_secret_for_dev_only",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));

  // Setup OAuth routes
  app.get("/api/oauth/google/auth", (req, res) => {
    const oauth2Client = getOAuth2Client();
    const authorizeUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
      prompt: "consent",
    });
    res.json({ url: authorizeUrl });
  });

  app.get("/api/oauth/google/callback", async (req, res) => {
    const code = req.query.code as string;
    if (!code) {
      res.status(400).send("No code provided");
      return;
    }

    try {
      const oauth2Client = getOAuth2Client();
      const { tokens } = await oauth2Client.getToken(code);
      
      // Store tokens in session
      (req.session as any).tokens = tokens;
      
      // Return a self-closing HTML page since this is opened in a popup
      res.send(`
        <html>
          <body>
            <script>
              window.opener.postMessage({ type: 'GOOGLE_OAUTH_SUCCESS' }, '*');
              window.close();
            </script>
            <p>Authentication successful! You can close this window.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Error retrieving access token", error);
      res.status(500).send("Error authenticating");
    }
  });

  app.get("/api/oauth/google/status", (req, res) => {
    const tokens = (req.session as any).tokens;
    res.json({ authenticated: !!tokens });
  });

  // Endpoints for saving and loading from Google Drive
  
  const FILE_NAME = "contabil_employees.json";

  app.post("/api/drive/save", async (req, res) => {
    const tokens = (req.session as any).tokens;
    if (!tokens) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      const oauth2Client = getOAuth2Client();
      oauth2Client.setCredentials(tokens);
      
      const drive = google.drive({ version: 'v3', auth: oauth2Client });
      
      // 1. Check if file already exists
      const searchRes = await drive.files.list({
        q: `name='${FILE_NAME}' and trashed=false`,
        spaces: 'drive',
        fields: 'files(id, name)'
      });

      const fileMetadata = { name: FILE_NAME };
      const media = {
        mimeType: 'application/json',
        body: JSON.stringify(req.body)
      };

      if (searchRes.data.files && searchRes.data.files.length > 0) {
        // Update existing file
        const fileId = searchRes.data.files[0].id!;
        await drive.files.update({
          fileId,
          media: media
        });
      } else {
        // Create new file
        await drive.files.create({
          requestBody: fileMetadata,
          media: media,
          fields: 'id'
        });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Drive save error:", error);
      res.status(500).json({ error: "Failed to save to Drive" });
    }
  });

  app.get("/api/drive/load", async (req, res) => {
    const tokens = (req.session as any).tokens;
    if (!tokens) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      const oauth2Client = getOAuth2Client();
      oauth2Client.setCredentials(tokens);
      
      const drive = google.drive({ version: 'v3', auth: oauth2Client });
      
      // Find the file
      const searchRes = await drive.files.list({
        q: `name='${FILE_NAME}' and trashed=false`,
        spaces: 'drive',
        fields: 'files(id, name)'
      });

      if (!searchRes.data.files || searchRes.data.files.length === 0) {
        res.json({ employees: null }); // File not found, means no saved data
        return;
      }

      const fileId = searchRes.data.files[0].id!;
      
      // Download file content
      const fileRes = await drive.files.get({
        fileId: fileId,
        alt: 'media'
      });
      
      res.json({ employees: fileRes.data });
    } catch (error) {
      console.error("Drive load error:", error);
      res.status(500).json({ error: "Failed to load from Drive" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
