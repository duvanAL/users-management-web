// Synthetic upstream for frontend contract tests, never a production service.
import http from "node:http";
import { spawn } from "node:child_process";
import { readFileSync, cpSync, mkdirSync } from "node:fs";
import { SignJWT } from "jose";
const env = Object.fromEntries(
  readFileSync("infra/dev.env", "utf8")
    .split(/\r?\n/)
    .filter((x) => x.includes("="))
    .map((x) => [x.slice(0, x.indexOf("=")), x.slice(x.indexOf("=") + 1)]),
);
const users = [
  ["admin", "DevAdmin123!", "ADMIN"],
  ["auditor", "DevReview123!", "REVIEWER"],
  ["usuario", "DevMember123!", "MEMBER"],
];
const server = http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  let result = { items: [], total: 0 };
  if (req.url === "/api/auth/login") {
    let raw = "";
    for await (const c of req) raw += c;
    const b = JSON.parse(raw);
    const user = users.find(
      (u) => b.email === u[0] + "@dev.local" && b.password === u[1],
    );
    if (!user) {
      res.writeHead(401);
      res.end("{}");
      return;
    }
    result = {
      accessToken: await new SignJWT({ role: user[2] })
        .setSubject("10000000-0000-4000-8000-000000000001")
        .setIssuedAt()
        .setExpirationTime("1h")
        .setProtectedHeader({ alg: "HS512" })
        .sign(Buffer.from(env.JWT_SECRET, "base64")),
    };
  } else if (req.url === "/api/me")
    result = {
      id: "10000000-0000-4000-8000-000000000001",
      name: "Duvan",
      email: "admin@dev.local",
      role: "ADMIN",
      status: "ACTIVE",
    };
  res.end(JSON.stringify(result));
});
server.listen(3199, "127.0.0.1");
mkdirSync(".next/standalone/.next", { recursive: true });
cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });
const child = spawn(process.execPath, [".next/standalone/server.js"], {
  stdio: "inherit",
  env: {
    ...process.env,
    ...env,
    PORT: "3100",
    HOSTNAME: "127.0.0.1",
    COOKIE_SECURE: "false",
    WEB_DEMO_ACCESS: "true",
    WEB_ORIGINS: "http://127.0.0.1:3100",
    ...Object.fromEntries(
      ["USERS", "ACCOUNTS", "FILES", "SEARCH", "NOTIFICATIONS"].map((n) => [
        n + "_URL",
        "http://127.0.0.1:3199",
      ]),
    ),
  },
});
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    child.kill(signal);
    server.close();
  });
child.on("exit", (code) => {
  server.close();
  process.exitCode = code ?? 1;
});
