import { session, upstream, HttpError, failure } from "@/lib/server";
export async function GET(req: Request) {
  try {
    const s = await session();
    const q = new URL(req.url).searchParams;
    const owner = q.get("userId") || "";
    const id = q.get("fileId") || "";
    if (!/^[a-zA-Z0-9-]{1,80}$/.test(owner) || !/^[a-zA-Z0-9-]{1,80}$/.test(id))
      throw new HttpError(400, "Referencia inválida.");
    if (s.role !== "ADMIN" && owner !== s.userId)
      throw new HttpError(403, "Acceso denegado.");
    const path = "/api/users/" + owner + "/files/" + id;
    const r = await upstream("users", path + "/download", s);
    if (!r.ok)
      throw new HttpError(r.status, "No pudimos preparar la descarga.");
    const ref = await r.json();
    const url = new URL(ref.url);
    if (
      url.username ||
      url.password ||
      url.origin !== process.env.FILE_DOWNLOAD_ORIGIN
    )
      throw new HttpError(502, "Origen de descarga no permitido.");
    const file = await fetch(url, {
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
    if (!file.ok) throw new HttpError(502, "No pudimos descargar el archivo.");
    const meta = await upstream("users", path, s);
    const name = meta.ok ? (await meta.json()).name : "archivo";
    return new Response(file.body, {
      headers: {
        "Content-Type":
          file.headers.get("Content-Type") || "application/octet-stream",
        "Content-Disposition":
          "attachment; filename*=UTF-8''" + encodeURIComponent(name),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
