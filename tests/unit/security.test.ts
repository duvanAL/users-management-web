import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";
const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (jar.has(k) ? { value: jar.get(k) } : undefined),
    set: (k: string, v: string) => jar.set(k, v),
    delete: (k: string) => jar.delete(k),
  }),
}));
import * as server from "@/lib/server";
import {
  GET as gateway,
  POST as gatewayPost,
} from "@/app/api/gateway/[service]/[...path]/route";
import { GET as auth } from "@/app/api/auth/[action]/route";
import { GET as download } from "@/app/api/download/route";
const key = Buffer.alloc(64, 7);
const owner = "owner-1";
let fetchMock: ReturnType<typeof vi.fn>;
async function actor(role = "ADMIN", expired = false) {
  const token = await new SignJWT({ role })
    .setProtectedHeader({ alg: "HS512" })
    .setSubject(owner)
    .setIssuedAt()
    .setExpirationTime(expired ? 1 : Math.floor(Date.now() / 1000) + 3600)
    .sign(key);
  if (!expired) await server.saveSession(await server.verifyToken(token));
  return token;
}
function req(
  path: string,
  method = "GET",
  body?: BodyInit,
  headers: Record<string, string> = {},
) {
  return new Request("http://localhost:3000" + path, {
    method,
    body,
    headers: { Origin: "http://localhost:3000", ...headers },
  });
}
function ctx(service: string, path: string[]) {
  return { params: Promise.resolve({ service, path }) };
}
beforeEach(() => {
  jar.clear();
  vi.stubEnv("JWT_SECRET", key.toString("base64"));
  vi.stubEnv("WEB_SESSION_KEY", Buffer.alloc(32, 8).toString("base64"));
  vi.stubEnv("WEB_ORIGINS", "http://localhost:3000");
  for (const n of [
    "USERS_URL",
    "ACCOUNTS_URL",
    "FILES_URL",
    "SEARCH_URL",
    "NOTIFICATIONS_URL",
  ])
    vi.stubEnv(n, "http://upstream.test");
  vi.stubEnv("FILE_DOWNLOAD_ORIGIN", "https://storage.test");
  fetchMock = vi
    .fn()
    .mockImplementation(async () =>
      Response.json({ id: owner, email: "admin@dev.local" }),
    );
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("session security", () => {
  it("encrypts sessions, validates roles and rejects tampering, expiration and wrong signatures", async () => {
    const token = await actor();
    expect((await server.session()).token).toBe(token);
    expect(jar.get("mgmt_session")).not.toContain(token);
    jar.set("mgmt_session", "broken");
    await expect(server.session()).rejects.toMatchObject({ status: 401 });
    await expect(
      server.verifyToken(await actor("ADMIN", true)),
    ).rejects.toThrow();
    await expect(actor("ROOT")).rejects.toThrow();
    vi.stubEnv("JWT_SECRET", Buffer.alloc(64, 9).toString("base64"));
    await expect(server.verifyToken(token)).rejects.toThrow();
  });
  it.each([32, 48, 64])("supports JJWT key length %s", async (length) => {
    const k = Buffer.alloc(length, 1);
    vi.stubEnv("JWT_SECRET", k.toString("base64"));
    const token = await new SignJWT({ role: "MEMBER" })
      .setSubject(owner)
      .setIssuedAt()
      .setExpirationTime("1h")
      .setProtectedHeader({
        alg: length === 32 ? "HS256" : length === 48 ? "HS384" : "HS512",
      })
      .sign(k);
    expect((await server.verifyToken(token)).role).toBe("MEMBER");
  });
  it("rejects missing configuration and untrusted mutation origins", async () => {
    vi.stubEnv("JWT_SECRET", "");
    await expect(server.verifyToken("invalid")).rejects.toThrow();
    expect(() =>
      server.csrf(req("/", "POST", undefined, { Origin: "https://evil.test" })),
    ).toThrow();
    expect(() => server.csrf(req("/"))).not.toThrow();
  });
});
describe("BFF boundaries", () => {
  it("rejects unauthenticated operations and clears invalid session", async () => {
    expect((await gateway(req("/"), ctx("users", ["users"]))).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(["ADMIN", "REVIEWER", "MEMBER"])(
    "enforces permissions for %s",
    async (role) => {
      await actor(role);
      expect((await gateway(req("/"), ctx("users", ["users"]))).status).toBe(
        role === "MEMBER" ? 403 : 200,
      );
      expect(
        (await gatewayPost(req("/", "POST", "{}"), ctx("users", ["users"])))
          .status,
      ).toBe(role === "ADMIN" ? 200 : 403);
      expect(
        (await gateway(req("/"), ctx("files", ["users", "other", "files"])))
          .status,
      ).toBe(role === "ADMIN" ? 200 : 403);
    },
  );
  it("forwards original JWT and allowlisted query parameters only", async () => {
    const token = await actor();
    await gateway(req("/?q=abc&limit=5&evil=1"), ctx("search", ["users"]));
    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://upstream.test/api/search/users?q=abc&limit=5",
    );
    expect(fetchMock.mock.calls[0][1].headers.get("Authorization")).toBe(
      "Bearer " + token,
    );
    expect(fetchMock.mock.calls[0][1].redirect).toBe("error");
  });
  it("handles account, user, notification and file operations", async () => {
    await actor();
    for (const [s, path] of [
      ["users", ["me"]],
      ["users", ["users", owner]],
      ["accounts", ["me"]],
      ["accounts", ["accounts", owner]],
      ["notifications", ["history"]],
      ["files", ["users", owner, "files"]],
    ] as [string, string[]][]) {
      expect(
        (await gateway(req("/?limit=3&status=SENT"), ctx(s, path))).status,
      ).toBe(200);
    }
    expect(
      (await gateway(req("/"), ctx("accounts", ["accounts"]))).status,
    ).toBe(400);
    expect(
      (await gateway(req("/?userId=x"), ctx("accounts", ["accounts"]))).status,
    ).toBe(200);
    expect(
      (
        await gateway(
          req("/", "DELETE"),
          ctx("files", ["users", owner, "files", "f1"]),
        )
      ).status,
    ).toBe(200);
    expect(
      (await gateway(req("/", "PUT", "{}"), ctx("users", ["users", owner])))
        .status,
    ).toBe(200);
    expect(
      (await gateway(req("/", "POST", "{}"), ctx("accounts", ["accounts"])))
        .status,
    ).toBe(200);
  });
  it("rejects arbitrary routes, invalid JSON and oversized requests", async () => {
    await actor();
    expect(
      (await gateway(req("/"), ctx("search", ["..", "..", "health"]))).status,
    ).toBe(403);
    expect(
      (await gateway(req("/", "POST", "{broken"), ctx("users", ["users"])))
        .status,
    ).toBe(400);
    expect(
      (
        await gateway(
          req("/", "POST", "x".repeat(32769)),
          ctx("users", ["users"]),
        )
      ).status,
    ).toBe(413);
    expect(
      (
        await gateway(
          req("/", "POST", "abc"),
          ctx("files", ["users", owner, "files"]),
        )
      ).status,
    ).toBe(415);
  });
  it("forwards multipart idempotency and revision headers", async () => {
    await actor();
    const form = new FormData();
    form.set(
      "file",
      new File(["%PDF-test"], "test.pdf", { type: "application/pdf" }),
    );
    expect(
      (
        await gateway(
          req("/", "PUT", form, {
            "Idempotency-Key": "key1",
            "If-Match": "v1",
          }),
          ctx("files", ["users", owner, "files", "f1"]),
        )
      ).status,
    ).toBe(200);
    const init = fetchMock.mock.calls[0][1];
    expect(init.headers.get("If-Match")).toBe("v1");
    expect(init.headers.get("Idempotency-Key")).toBe("key1");
  });
  it("sanitizes provider errors and rejects non JSON replies", async () => {
    await actor();
    fetchMock.mockResolvedValueOnce(new Response("secret", { status: 500 }));
    const r = await gateway(req("/"), ctx("users", ["me"]));
    expect(r.status).toBe(500);
    expect(await r.text()).not.toContain("secret");
    fetchMock.mockResolvedValueOnce(new Response("not json"));
    expect((await gateway(req("/"), ctx("users", ["me"]))).status).toBe(502);
    fetchMock.mockRejectedValueOnce(new Error("private credentials"));
    expect((await gateway(req("/"), ctx("users", ["me"]))).status).toBe(503);
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    expect((await gateway(req("/"), ctx("users", ["me"]))).status).toBe(204);
    vi.stubEnv("USERS_URL", "");
    expect((await gateway(req("/"), ctx("users", ["me"]))).status).toBe(503);
  });
});
describe("auth endpoints", () => {
  it("logs in, reads session and logs out without exposing JWT", async () => {
    const token = await actor();
    jar.clear();
    fetchMock.mockResolvedValueOnce(Response.json({ accessToken: token }));
    const c = (action: string) => ({ params: Promise.resolve({ action }) });
    const r = await auth(
      req("/", "POST", JSON.stringify({ email: "x", password: "password" })),
      c("login"),
    );
    expect(r.status).toBe(200);
    expect(await r.text()).not.toContain(token);
    expect((await auth(req("/"), c("session"))).status).toBe(200);
    expect((await auth(req("/", "POST"), c("logout"))).status).toBe(200);
    expect(jar.size).toBe(0);
    expect((await auth(req("/"), c("unknown"))).status).toBe(404);
  });
  it("rejects malformed and excessive login attempts", async () => {
    const c = { params: Promise.resolve({ action: "login" }) };
    for (const [body, status] of [
      ["{", 400],
      ["{}", 400],
      ["null", 400],
      ["x".repeat(8200), 413],
    ] as const)
      expect((await auth(req("/", "POST", body), c)).status).toBe(status);
    fetchMock.mockImplementation(async () => new Response("", { status: 401 }));
    let r: Response;
    for (let i = 0; i < 22; i++)
      r = await auth(
        req("/", "POST", JSON.stringify({ email: "x", password: "p" }), {
          "x-forwarded-for": "rate-test",
        }),
        c,
      );
    expect(r!.status).toBe(429);
  });
});
describe("downloads", () => {
  it("checks ownership and blocks signed URLs outside configured origin", async () => {
    await actor("MEMBER");
    expect(
      (await download(req("/api/download?userId=other&fileId=f1"))).status,
    ).toBe(403);
    expect(
      (await download(req("/api/download?userId=bad%2Fid&fileId=f1"))).status,
    ).toBe(400);
    fetchMock.mockResolvedValueOnce(
      Response.json({ url: "https://evil.test/private" }),
    );
    expect(
      (await download(req("/api/download?userId=" + owner + "&fileId=f1")))
        .status,
    ).toBe(502);
  });
  it("streams permitted content as an attachment", async () => {
    await actor();
    fetchMock
      .mockResolvedValueOnce(
        Response.json({ url: "https://storage.test/file?signature=secret" }),
      )
      .mockResolvedValueOnce(
        new Response("%PDF-test", {
          headers: { "Content-Type": "application/pdf" },
        }),
      )
      .mockResolvedValueOnce(Response.json({ name: "document.pdf" }));
    const r = await download(
      req("/api/download?userId=" + owner + "&fileId=f1"),
    );
    expect(r.status).toBe(200);
    expect(r.headers.get("Content-Disposition")).toContain("document.pdf");
    expect(await r.text()).toBe("%PDF-test");
    expect(r.headers.get("Cache-Control")).toBe("no-store");
  });
});

it("health is public and uncached", async () => {
  const { GET } = await import("@/app/api/health/route");
  const r = GET();
  expect(await r.json()).toEqual({ status: "ok" });
  expect(r.headers.get("Cache-Control")).toBe("no-store");
});
