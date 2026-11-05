import { cookies } from "next/headers";
import { EncryptJWT, jwtDecrypt, jwtVerify } from "jose";
export type Role = "ADMIN" | "REVIEWER" | "MEMBER";
export type Session = {
  token: string;
  userId: string;
  role: Role;
  exp: number;
};
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const cookieName = "mgmt_session";
function key(name: string) {
  const value = process.env[name];
  if (!value) throw new Error("Server configuration missing");
  return new Uint8Array(Buffer.from(value, "base64"));
}
export async function verifyToken(token: string): Promise<Session> {
  const k = key("JWT_SECRET");
  const algorithm =
    k.length >= 64 ? "HS512" : k.length >= 48 ? "HS384" : "HS256";
  const { payload } = await jwtVerify(token, k, {
    algorithms: [algorithm],
    requiredClaims: ["exp", "iat", "sub", "role"],
  });
  if (
    !payload.sub ||
    !["ADMIN", "REVIEWER", "MEMBER"].includes(String(payload.role))
  )
    throw new HttpError(401, "Sesión inválida.");
  return {
    token,
    userId: payload.sub,
    role: payload.role as Role,
    exp: payload.exp!,
  };
}
export async function saveSession(s: Session) {
  const jar = await cookies();
  const encrypted = await new EncryptJWT({ token: s.token })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(s.exp)
    .encrypt(key("WEB_SESSION_KEY"));
  jar.set(cookieName, encrypted, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    expires: new Date(s.exp * 1000),
  });
}
export async function clearSession() {
  (await cookies()).delete(cookieName);
}
export async function session(): Promise<Session> {
  try {
    const value = (await cookies()).get(cookieName)?.value;
    if (!value) throw 0;
    const { payload } = await jwtDecrypt(value, key("WEB_SESSION_KEY"), {
      keyManagementAlgorithms: ["dir"],
      contentEncryptionAlgorithms: ["A256GCM"],
    });
    return await verifyToken(String(payload.token));
  } catch {
    throw new HttpError(401, "Tu sesión terminó. Inicia sesión nuevamente.");
  }
}
export function csrf(req: Request) {
  if (["GET", "HEAD"].includes(req.method)) return;
  const allowed = (
    process.env.WEB_ORIGINS || "http://localhost:3000,http://127.0.0.1:3000"
  ).split(",");
  if (!allowed.includes(req.headers.get("origin") || ""))
    throw new HttpError(403, "Origen de solicitud no permitido.");
}
export const bases = () => ({
  users: process.env.USERS_URL!,
  accounts: process.env.ACCOUNTS_URL!,
  files: process.env.FILES_URL!,
  search: process.env.SEARCH_URL!,
  notifications: process.env.NOTIFICATIONS_URL!,
});
export async function upstream(
  service: keyof ReturnType<typeof bases>,
  path: string,
  s?: Session,
  init: RequestInit = {},
) {
  const base = bases()[service];
  if (!base) throw new HttpError(503, "Servicio sin configurar.");
  const headers = new Headers(init.headers);
  if (s) headers.set("Authorization", "Bearer " + s.token);
  try {
    return await fetch(base + path, {
      ...init,
      headers,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    throw new HttpError(
      503,
      "El servicio no está disponible. Intenta nuevamente.",
    );
  }
}
export function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export async function failure(e: unknown) {
  const status = e instanceof HttpError ? e.status : 500;
  if (status === 401) await clearSession();
  return json(
    {
      message:
        e instanceof HttpError
          ? e.message
          : "No pudimos completar la operación.",
    },
    status,
  );
}
export async function relay(r: Response) {
  if (r.status === 204)
    return new Response(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
  if (!r.ok) {
    const messages: Record<number, string> = {
      400: "Revisa los datos ingresados.",
      401: "Tu sesión terminó.",
      403: "No tienes permiso para esta operación.",
      404: "El registro no existe.",
      409: "Los datos ya existen o la operación está en curso.",
      412: "El archivo cambió. Actualiza la lista antes de reemplazarlo.",
      413: "El archivo supera el tamaño permitido.",
      415: "El formato del archivo no está permitido.",
      422: "El contenido del archivo no es válido.",
    };
    throw new HttpError(
      r.status,
      messages[r.status] || "El servicio no pudo completar la operación.",
    );
  }
  const text = await r.text();
  try {
    return json(JSON.parse(text), r.status);
  } catch {
    throw new HttpError(502, "Respuesta inesperada del servicio.");
  }
}
export async function boundedBody(req: Request, max: number) {
  const reader = req.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max) {
        await reader.cancel();
        throw new HttpError(413, "Solicitud demasiado grande.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}
