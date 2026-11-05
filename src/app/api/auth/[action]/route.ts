import {
  csrf,
  session,
  verifyToken,
  saveSession,
  clearSession,
  upstream,
  json,
  failure,
  relay,
  HttpError,
  boundedBody,
} from "@/lib/server";
export const runtime = "nodejs";
const attempts = new Map<string, { n: number; until: number }>();
async function handle(
  req: Request,
  ctx: { params: Promise<{ action: string }> },
) {
  try {
    csrf(req);
    const { action } = await ctx.params;
    if (action === "session" && req.method === "GET") {
      const s = await session();
      const r = await upstream("users", "/api/me", s);
      if (!r.ok) return relay(r);
      return json({
        user: await r.json(),
        role: s.role,
        expiresAt: s.exp * 1000,
      });
    }
    if (action === "logout" && req.method === "POST") {
      await clearSession();
      return json({ ok: true });
    }
    if (action === "login" && req.method === "POST") {
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "local";
      const now = Date.now();
      for (const [k, v] of attempts) if (v.until < now) attempts.delete(k);
      let a = attempts.get(ip);
      if (!a) {
        if (attempts.size > 1000)
          throw new HttpError(429, "Intenta más tarde.");
        a = { n: 0, until: now + 60000 };
        attempts.set(ip, a);
      }
      if (++a.n > 20)
        throw new HttpError(
          429,
          "Espera un minuto antes de intentar nuevamente.",
        );
      let body;
      try {
        body = JSON.parse(Buffer.from(await boundedBody(req, 8192)).toString());
      } catch (e) {
        if (e instanceof HttpError) throw e;
        throw new HttpError(400, "Solicitud inválida.");
      }
      if (typeof body.email !== "string" || typeof body.password !== "string")
        throw new HttpError(400, "Ingresa correo y contraseña.");
      const r = await upstream("users", "/api/auth/login", undefined, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: body.email, password: body.password }),
      });
      if (!r.ok)
        throw new HttpError(
          r.status === 401 ? 401 : 400,
          "Revisa tu correo y contraseña.",
        );
      const result = await r.json();
      const s = await verifyToken(result.accessToken);
      await saveSession(s);
      attempts.delete(ip);
      return json({ role: s.role });
    }
    throw new HttpError(404, "Ruta no disponible.");
  } catch (e) {
    return failure(e);
  }
}
export { handle as GET, handle as POST };
