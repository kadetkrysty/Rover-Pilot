import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { createServer as createHttpsServer } from "https";
import { existsSync, readFileSync } from "node:fs";
import { recordingService } from "./recordingRoutes";

const app = express();
const httpServer = createServer(app);
const tlsCertificate = process.env.ROVEROS_TLS_CERT || "/etc/roveros-provisioner/server.crt";
const tlsPrivateKey = process.env.ROVEROS_TLS_KEY || "/etc/roveros-provisioner/server.key";
const secureServer =
  existsSync(tlsCertificate) && existsSync(tlsPrivateKey)
    ? createHttpsServer(
        {
          cert: readFileSync(tlsCertificate),
          key: readFileSync(tlsPrivateKey),
          minVersion: "TLSv1.2",
        },
        app,
      )
    : undefined;

let shuttingDown = false;
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    const deadline = setTimeout(() => process.exit(1), 15000);
    deadline.unref();
    void recordingService.shutdown().finally(() => {
      httpServer.close();
      secureServer?.close();
      process.exit(0);
    });
  });
}

// Capacitor Android serves the bundled UI from https://localhost. Allow that
// exact origin to call the MiniPC API; do not use a wildcard for rover controls.
const nativeClientOrigins = new Set(["https://localhost"]);
app.use((req, res, next) => {
  const origin = req.get("origin");
  const isNativeClient = origin !== undefined && nativeClientOrigins.has(origin);

  if (isNativeClient) {
    res.vary("Origin");
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Max-Age", "600");

    if (req.get("access-control-request-private-network") === "true") {
      res.setHeader("Access-Control-Allow-Private-Network", "true");
    }
  }

  if (req.method === "OPTIONS") {
    return res.sendStatus(isNativeClient ? 204 : 403);
  }

  next();
});

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        const containsSensitiveData =
          path.startsWith("/api/recordings") ||
          path.startsWith("/api/maps") ||
          path.startsWith("/api/drive") ||
          path.startsWith("/api/clients") ||
          path.startsWith("/api/config") ||
          path === "/api/export/all" ||
          path === "/api/import";
        if (capturedJsonResponse && !path.startsWith("/api/provisioning") && !containsSensitiveData) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app, secureServer);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
  if (secureServer) {
    const tlsPort = parseInt(process.env.ROVEROS_TLS_PORT || "5443", 10);
    secureServer.listen(tlsPort, "0.0.0.0", () => {
      log(`secure API serving on port ${tlsPort}`);
    });
  } else {
    log("secure API is unavailable until the MiniPC certificate and key are installed");
  }
})();
