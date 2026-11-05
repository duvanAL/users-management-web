import { test, expect, request, APIRequestContext } from "@playwright/test";
const uid = "10000000-0000-4000-8000-000000000003";
const gw = "/api/gateway/";
async function login(role = "admin") {
  const c = await request.newContext({
    baseURL: "http://localhost:3000",
    extraHTTPHeaders: { Origin: "http://localhost:3000" },
  });
  const names: Record<string, string> = {
    admin: "DevAdmin123!",
    auditor: "DevReview123!",
    usuario: "DevMember123!",
  };
  const r = await c.post("/api/auth/login", {
    data: { email: role + "@dev.local", password: names[role] },
  });
  expect(r.status(), await r.text()).toBe(200);
  return c;
}
async function ok(r: any) {
  expect(r.ok(), await r.text()).toBeTruthy();
  return r.json();
}
test("anonymous, CSRF, encrypted cookie and role boundaries", async () => {
  const a = await request.newContext({
    baseURL: "http://localhost:3000",
    extraHTTPHeaders: { Origin: "http://evil.invalid" },
  });
  expect((await a.get(gw + "users/users")).status()).toBe(401);
  expect(
    (
      await a.post("/api/auth/login", { data: { email: "x", password: "x" } })
    ).status(),
  ).toBe(403);
  await a.dispose();
  for (const role of ["admin", "auditor", "usuario"]) {
    const c = await login(role);
    const profile = await ok(await c.get("/api/auth/session"));
    expect(profile.user.email).toBe(role + "@dev.local");
    expect(profile).not.toHaveProperty("token");
    const cookies = (await c.storageState()).cookies;
    expect(cookies[0].httpOnly).toBeTruthy();
    expect(cookies[0].value.split(".")).toHaveLength(5);
    expect((await c.get(gw + "users/users")).status()).toBe(
      role === "usuario" ? 403 : 200,
    );
    expect(
      (await c.post(gw + "accounts/accounts", { data: {} })).status(),
    ).toBe(role === "admin" ? 400 : 403);
    expect((await c.get(gw + "accounts/me")).status()).toBe(200);
    expect(
      (
        await c.get(
          gw +
            "files/users/" +
            (role === "admin" ? uid : "10000000-0000-4000-8000-000000000001") +
            "/files",
        )
      ).status(),
    ).toBe(role === "admin" ? 200 : 403);
    if (role === "usuario")
      expect(
        (await c.get(gw + "notifications/history?userId=other")).status(),
      ).toBe(403);
    expect((await c.get(gw + "search/../../health")).status()).not.toBe(200);
    await c.post("/api/auth/logout");
    expect((await c.get("/api/auth/session")).status()).toBe(401);
    await c.dispose();
  }
});
test("transactional user changes reach search and notification history", async () => {
  const c = await login();
  const id = crypto.randomUUID();
  const name = "Prueba Web " + id.slice(0, 8);
  const email = "web-" + id + "@dev.local";
  try {
    const user = await ok(
      await c.post(gw + "users/users", {
        data: { id, name, email, password: "TestingDev123!", role: "MEMBER" },
      }),
    );
    expect(user.id).toBe(id);
    await expect
      .poll(
        async () => {
          const r = await c.get(
            gw + "search/users?q=" + encodeURIComponent(email),
          );
          if (!r.ok()) return false;
          return (await r.json()).items.some((x: any) => x.id === id);
        },
        { timeout: 60000 },
      )
      .toBe(true);
    await expect
      .poll(
        async () => {
          const d = await ok(
            await c.get(gw + "notifications/history?userId=" + id),
          );
          return d.items.some(
            (x: any) => x.eventName === "user.created" && x.status === "SENT",
          );
        },
        { timeout: 60000 },
      )
      .toBe(true);
    const changed = name + " actualizado";
    await ok(
      await c.put(gw + "users/users/" + id, {
        data: { name: changed, email, role: "MEMBER", status: "ACTIVE" },
      }),
    );
    await expect
      .poll(
        async () => {
          const d = await ok(
            await c.get(gw + "search/users?q=" + encodeURIComponent(email)),
          );
          return d.items.some((x: any) => x.name === changed);
        },
        { timeout: 60000 },
      )
      .toBe(true);
  } finally {
    await c.delete(gw + "users/users/" + id);
  }
  await expect
    .poll(
      async () => {
        const d = await ok(
          await c.get(gw + "search/users?q=" + encodeURIComponent(email)),
        );
        return d.items.length;
      },
      { timeout: 60000 },
    )
    .toBe(0);
  await c.dispose();
});
test("account opening, owner queries and event delivery", async () => {
  const c = await login();
  const a = await ok(
    await c.post(gw + "accounts/accounts", {
      data: { userId: uid, accountType: "SAVINGS" },
    }),
  );
  expect(a.userId).toBe(uid);
  const member = await login("usuario");
  expect(
    (await ok(await member.get(gw + "accounts/me"))).some(
      (x: any) => x.id === a.id,
    ),
  ).toBe(true);
  await expect
    .poll(
      async () => {
        const d = await ok(await c.get(gw + "search/accounts?userId=" + uid));
        return d.items.some((x: any) => x.id === a.id);
      },
      { timeout: 60000 },
    )
    .toBe(true);
  await expect
    .poll(
      async () => {
        const d = await ok(
          await c.get(gw + "notifications/history?userId=" + uid),
        );
        return d.items.some(
          (x: any) => x.eventName === "account.created" && x.status === "SENT",
        );
      },
      { timeout: 60000 },
    )
    .toBe(true);
  await c.dispose();
  await member.dispose();
});
test("versioned file lifecycle, idempotency and stale replacement", async () => {
  const c = await login("usuario");
  const base = gw + "files/users/" + uid + "/files";
  const key = crypto.randomUUID();
  const pdf = Buffer.from("%PDF-1.4\n1 0 obj <</Type /Catalog>> endobj\n%%EOF");
  const payload = {
    file: { name: "prueba.pdf", mimeType: "application/pdf", buffer: pdf },
  };
  let id = "";
  try {
    const f = await ok(
      await c.post(base, {
        headers: { "Idempotency-Key": key },
        multipart: payload,
      }),
    );
    id = f.id;
    expect(f.name).toBe("prueba.pdf");
    const repeat = await ok(
      await c.post(base, {
        headers: { "Idempotency-Key": key },
        multipart: payload,
      }),
    );
    expect(repeat.id).toBe(id);
    const down = await c.get("/api/download?userId=" + uid + "&fileId=" + id);
    expect(down.status(), await down.text()).toBe(200);
    expect((await down.body()).equals(pdf)).toBe(true);
    const replaced = await ok(
      await c.put(base + "/" + id, {
        headers: {
          "Idempotency-Key": crypto.randomUUID(),
          "If-Match": f.revision,
        },
        multipart: {
          file: {
            name: "nueva.pdf",
            mimeType: "application/pdf",
            buffer: Buffer.concat([pdf, Buffer.from("\nchanged")]),
          },
        },
      }),
    );
    expect(replaced.revision).not.toBe(f.revision);
    expect(
      (
        await c.put(base + "/" + id, {
          headers: {
            "Idempotency-Key": crypto.randomUUID(),
            "If-Match": f.revision,
          },
          multipart: payload,
        })
      ).status(),
    ).toBe(412);
    expect(
      (
        await c.post(base, {
          headers: { "Idempotency-Key": crypto.randomUUID() },
          multipart: {
            file: {
              name: "evil.pdf",
              mimeType: "application/pdf",
              buffer: Buffer.from("not a pdf"),
            },
          },
        })
      ).status(),
    ).toBe(415);
  } finally {
    if (id) {
      const r = await c.delete(base + "/" + id);
      expect([202, 204]).toContain(r.status());
    }
    await c.dispose();
  }
});
test("provider failure is persisted without exposing payloads", async () => {
  const c = await login();
  const id = crypto.randomUUID();
  await fetch("http://localhost:18086/mode", { method: "POST", body: "fail" });
  try {
    await ok(
      await c.post(gw + "users/users", {
        data: {
          id,
          name: "Fallo Controlado",
          email: id + "@dev.local",
          password: "TestingDev123!",
          role: "MEMBER",
        },
      }),
    );
    await expect
      .poll(
        async () => {
          const d = await ok(
            await c.get(gw + "notifications/history?userId=" + id),
          );
          return d.items.some(
            (x: any) =>
              x.status === "FAILED" &&
              x.failureCode === "PROCESSING_RETRIES_EXHAUSTED",
          );
        },
        { timeout: 90000 },
      )
      .toBe(true);
    const raw = await (
      await c.get(gw + "notifications/history?userId=" + id)
    ).text();
    expect(raw).not.toContain("TestingDev123!");
    expect(raw).not.toContain("api-key");
  } finally {
    await fetch("http://localhost:18086/mode", {
      method: "POST",
      body: "success",
    });
    await c.delete(gw + "users/users/" + id);
    await c.dispose();
  }
});

test("tampered and expired sessions, invalid requests and upload bounds", async () => {
  const c = await login();
  expect(
    (
      await c.post("/api/auth/login", {
        data: "{broken",
        headers: { "Content-Type": "application/json" },
      })
    ).status(),
  ).toBe(400);
  expect((await c.get(gw + "unknown/anything")).status()).toBe(403);
  expect((await c.get(gw + "accounts/accounts")).status()).toBe(400);
  const oversized = Buffer.alloc(10485761, 65);
  expect(
    (
      await c.post(gw + "files/users/" + uid + "/files", {
        headers: { "Idempotency-Key": crypto.randomUUID() },
        multipart: {
          file: {
            name: "large.pdf",
            mimeType: "application/pdf",
            buffer: oversized,
          },
        },
      })
    ).status(),
  ).toBe(413);
  const state = await c.storageState();
  const original = state.cookies[0];
  const parts = original.value.split(".");
  parts[3] = (parts[3][0] === "A" ? "B" : "A") + parts[3].slice(1);
  const bad = await request.newContext({
    baseURL: "http://localhost:3000",
    storageState: {
      cookies: [{ ...original, value: parts.join(".") }],
      origins: [],
    },
  });
  expect((await bad.get("/api/auth/session")).status()).toBe(401);
  const { EncryptJWT, SignJWT } = await import("jose");
  const { readFileSync } = await import("node:fs");
  const env = Object.fromEntries(
    readFileSync("infra/dev.env", "utf8")
      .split("\n")
      .filter((x) => x.includes("="))
      .map((x) => {
        const n = x.indexOf("=");
        return [x.slice(0, n), x.slice(n + 1)];
      }),
  );
  const expired = await new SignJWT({ role: "ADMIN" })
    .setProtectedHeader({ alg: "HS512" })
    .setSubject(uid)
    .setIssuedAt(1)
    .setExpirationTime(2)
    .sign(Buffer.from(env.JWT_SECRET, "base64"));
  const wrapper = await new EncryptJWT({ token: expired })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setExpirationTime("1h")
    .encrypt(Buffer.from(env.WEB_SESSION_KEY, "base64"));
  const old = await request.newContext({
    baseURL: "http://localhost:3000",
    storageState: { cookies: [{ ...original, value: wrapper }], origins: [] },
  });
  expect((await old.get("/api/auth/session")).status()).toBe(401);
  await c.dispose();
  await bad.dispose();
  await old.dispose();
});
