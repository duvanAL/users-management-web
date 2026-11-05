export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T = any>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const r = await fetch(path, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    if (r.status === 401 && location.pathname !== "/login")
      location.assign("/login");
    throw new ApiError(
      r.status,
      data.message || "No pudimos completar la operación.",
    );
  }
  return r.status === 204 ? (undefined as T) : await r.json();
}
export const send = (method: string, body: unknown) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
export const g = "/api/gateway/";
export const labels: Record<string, string> = {
  ADMIN: "Administrador",
  REVIEWER: "Revisor",
  MEMBER: "Miembro",
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
  BLOCKED: "Bloqueado",
  SAVINGS: "Ahorros",
  CHECKING: "Corriente",
  SENT: "Enviada",
  PENDING: "Pendiente",
  FAILED: "Fallida",
};
export const date = (v: string) =>
  new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(v));
