import {
  csrf,
  session,
  upstream,
  relay,
  failure,
  HttpError,
  boundedBody,
} from "@/lib/server";
export const runtime = "nodejs";
async function handle(
  req: Request,
  ctx: { params: Promise<{ service: string; path: string[] }> },
) {
  try {
    csrf(req);
    const s = await session();
    const { service, path } = await ctx.params;
    const p = "/" + path.join("/");
    const m = req.method;
    const u = new URL(req.url);
    const admin = s.role === "ADMIN";
    const staff = s.role !== "MEMBER";
    const id = "[a-zA-Z0-9-]{1,80}";
    let target = "";
    const headers = new Headers();
    let body: BodyInit | undefined;
    if (service === "users") {
      if (m === "GET" && p === "/me") target = "/api/me";
      else if (
        staff &&
        m === "GET" &&
        new RegExp("^/users(?:/" + id + ")?$").test(p)
      )
        target = "/api" + p;
      else if (
        admin &&
        ((m === "POST" && p === "/users") ||
          (["PUT", "DELETE"].includes(m) &&
            new RegExp("^/users/" + id + "$").test(p)))
      )
        target = "/api" + p;
    } else if (service === "accounts") {
      if (m === "GET" && p === "/me") target = "/api/me/accounts";
      else if (
        staff &&
        m === "GET" &&
        new RegExp("^/accounts(?:/" + id + ")?$").test(p)
      ) {
        if (p === "/accounts" && !u.searchParams.get("userId"))
          throw new HttpError(400, "Selecciona un propietario.");
        target = "/api" + p;
        if (u.searchParams.has("userId"))
          target +=
            "?" +
            new URLSearchParams({ userId: u.searchParams.get("userId")! });
      } else if (admin && m === "POST" && p === "/accounts")
        target = "/api/accounts";
    } else if (service === "files") {
      const match = p.match(
        new RegExp("^/users/(" + id + ")/files(?:/(" + id + "))?$"),
      );
      if (
        match &&
        (admin || match[1] === s.userId) &&
        ((m === "POST" && !match[2]) ||
          m === "GET" ||
          (["PUT", "DELETE"].includes(m) && !!match[2]))
      ) {
        target = "/api" + p;
        if (m === "GET") {
          const q = new URLSearchParams();
          for (const k of ["limit", "after"])
            if (u.searchParams.has(k)) q.set(k, u.searchParams.get(k)!);
          if (q.size) target += "?" + q;
        }
      }
    } else if (
      service === "search" &&
      m === "GET" &&
      ["/users", "/accounts"].includes(p)
    ) {
      const q = new URLSearchParams();
      for (const k of ["q", "userId", "limit", "offset"])
        if (u.searchParams.has(k)) q.set(k, u.searchParams.get(k)!);
      target = "/api/search" + p + "?" + q;
    } else if (service === "notifications" && m === "GET" && p === "/history") {
      const q = new URLSearchParams();
      for (const k of ["userId", "status", "limit", "offset"])
        if (u.searchParams.has(k)) q.set(k, u.searchParams.get(k)!);
      target = "/api/notifications?" + q;
    }
    if (!target) throw new HttpError(403, "Operación no permitida.");
    if (service === "files" && m === "DELETE")
      headers.set(
        "Idempotency-Key",
        req.headers.get("Idempotency-Key") || crypto.randomUUID(),
      );
    if (["POST", "PUT"].includes(m)) {
      const raw = await boundedBody(
        req,
        service === "files" ? 11 * 1024 * 1024 : 32768,
      );
      if (service === "files") {
        const type = req.headers.get("content-type") || "";
        if (!type.startsWith("multipart/form-data;"))
          throw new HttpError(415, "Usa un archivo PDF, PNG o JPEG.");
        const f = await new Request("http://local", {
          method: "POST",
          headers: { "Content-Type": type },
          body: raw,
        }).formData();
        const file = f.get("file");
        if (
          !(file instanceof File) ||
          f.getAll("file").length !== 1 ||
          file.size > 10485760
        )
          throw new HttpError(413, "Selecciona un archivo de hasta 10 MiB.");
        const clean = new FormData();
        clean.set("file", file);
        body = clean;
        for (const k of ["Idempotency-Key", "If-Match"]) {
          const v = req.headers.get(k);
          if (v) headers.set(k, v);
        }
      } else {
        let data;
        try {
          data = JSON.parse(Buffer.from(raw).toString());
        } catch {
          throw new HttpError(400, "Solicitud inválida.");
        }
        headers.set("Content-Type", "application/json");
        body = JSON.stringify(data);
      }
    }
    // User Service owns synchronous file integration and forwards the authenticated JWT.
    return await relay(
      await upstream(
        service === "files"
          ? "users"
          : (service as "users" | "accounts" | "search" | "notifications"),
        target,
        s,
        { method: m, headers, body },
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
export { handle as GET, handle as POST, handle as PUT, handle as DELETE };
