"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Plus,
  RefreshCw,
  ArrowUpRight,
  Search as SearchIcon,
  Download,
  Upload,
  Trash2,
  ArrowLeft,
  UserRound,
  FileText,
  Check,
  CheckCircle2,
  Wallet,
} from "lucide-react";
import { api, send, g, labels, date } from "@/lib/client";
import { motionReduced } from "@/lib/motion";
import { useActor } from "./shell";
import {
  useData,
  Heading,
  Badge,
  State,
  Modal,
  Notice,
  Pager,
  PagerButtons,
  AutoHeight,
  Exit,
  MotionControl,
  Submit,
  list,
  useAction,
  useFresh,
  useTabInk,
} from "./ui";
type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
};
type Account = {
  id: string;
  userId: string;
  accountType: string;
  createdAt: string;
};
type FileRef = {
  id: string;
  userId: string;
  name: string;
  size: number;
  mime: string;
  revision: string;
  updatedAt: string;
};
function Reload({ run, busy }: { run: () => void; busy: boolean }) {
  return (
    <button
      className="icon"
      aria-label="Actualizar datos"
      title="Actualizar datos"
      onClick={() => {
        if (!busy) run();
      }}
    >
      <RefreshCw size={17} className={busy ? "spin" : undefined} />
    </button>
  );
}
function UserForm({
  user,
  onDone,
  onClose,
}: {
  user?: User;
  onDone: () => void;
  onClose: () => void;
}) {
  const action = useAction();
  return (
    <Modal title={user ? "Editar usuario" : "Nuevo usuario"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const body: any = Object.fromEntries(f);
          if (!body.password) delete body.password;
          if (!user) body.id = crypto.randomUUID();
          action.run(
            () =>
              api(
                g + "users/users" + (user ? "/" + user.id : ""),
                send(user ? "PUT" : "POST", body),
              ),
            onDone,
          );
        }}
      >
        <label>
          Nombre completo
          <input
            name="name"
            defaultValue={user?.name}
            required
            minLength={3}
            maxLength={100}
          />
        </label>
        <label>
          Correo electrónico
          <input
            name="email"
            type="email"
            defaultValue={user?.email}
            required
            maxLength={150}
          />
        </label>
        <label>
          {user ? "Nueva contraseña (opcional)" : "Contraseña"}
          <input
            name="password"
            type="password"
            required={!user}
            minLength={8}
            autoComplete="new-password"
          />
        </label>
        <div className="form-row">
          <label>
            Rol
            <select name="role" defaultValue={user?.role || "MEMBER"}>
              {["MEMBER", "REVIEWER", "ADMIN"].map((v) => (
                <option key={v} value={v}>
                  {labels[v]}
                </option>
              ))}
            </select>
          </label>
          {user && (
            <label>
              Estado
              <select name="status" defaultValue={user.status}>
                {["ACTIVE", "PENDING", "INACTIVE", "BLOCKED"].map((v) => (
                  <option key={v} value={v}>
                    {labels[v] || v}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {!user && (
          <p className="hint">
            El usuario se crea pendiente. Actívalo desde su perfil para
            habilitar el ingreso.
          </p>
        )}
        {action.error && (
          <p role="alert" className="error">
            {action.error}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" onClick={onClose}>
            Cancelar
          </button>
          <Submit
            state={action.state}
            label="Guardar usuario"
            busy="Guardando…"
            done="Guardado"
          />
        </div>
      </form>
    </Modal>
  );
}
export function Users() {
  const { role } = useActor();
  const d = useData<User[]>(role === "MEMBER" ? null : g + "users/users");
  const [q, setQ] = useState("");
  const [create, setCreate] = useState(false);
  const [notice, setNotice] = useState("");
  const fresh = useFresh(d);
  const users = list(d.data).filter((u) =>
    (u.name + " " + u.email).toLowerCase().includes(q.toLowerCase()),
  );
  if (role === "MEMBER")
    return (
      <Heading
        title="Acceso restringido"
        description="Esta sección está disponible para administración y revisión."
      />
    );
  return (
    <>
      <Heading
        title="Usuarios"
        description="Personas, acceso y estado de cada cuenta."
      >
        <Reload run={d.reload} busy={d.loading} />
        {role === "ADMIN" && (
          <button className="primary" onClick={() => setCreate(true)}>
            <Plus size={17} />
            Nuevo usuario
          </button>
        )}
      </Heading>
      <Notice text={notice} onDone={() => setNotice("")} />
      <section className="panel">
        <div className="toolbar">
          <label className="search-input">
            <SearchIcon size={17} />
            <input
              aria-label="Filtrar usuarios"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre o correo"
            />
          </label>
          <span className="muted">
            {users.length} {users.length === 1 ? "usuario" : "usuarios"}
          </span>
        </div>
        <State
          {...d}
          onRetry={d.reload}
          empty={!users.length}
          emptyTitle={q ? `Sin resultados para “${q}”` : undefined}
          emptyText={q ? "Prueba con otro nombre o correo." : undefined}
          emptyAction={
            q ? (
              <button onClick={() => setQ("")}>Limpiar búsqueda</button>
            ) : null
          }
        >
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th aria-label="Acciones" className="end" />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} data-fresh={fresh.has(u.id) || undefined}>
                    <td>
                      <Link href={"/users/" + u.id} className="person">
                        <span className="avatar">{u.name[0]}</span>
                        <span>
                          <strong>{u.name}</strong>
                          <small>{u.email}</small>
                        </span>
                      </Link>
                    </td>
                    <td data-label="Rol">{labels[u.role]}</td>
                    <td data-label="Estado">
                      <Badge value={u.status} />
                    </td>
                    <td className="end">
                      <Link className="row-action" href={"/users/" + u.id}>
                        Ver detalle
                        <ArrowUpRight size={15} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </State>
      </section>
      <Exit>
        {create && (
          <UserForm
            onClose={() => setCreate(false)}
            onDone={() => {
              setCreate(false);
              setNotice(
                "Usuario creado. Revisa su estado antes de habilitar el acceso.",
              );
              d.reload();
            }}
          />
        )}
      </Exit>
    </>
  );
}
export function UserDetail({
  id,
  self = false,
}: {
  id: string;
  self?: boolean;
}) {
  const { role } = useActor();
  const d = useData<User>(self ? g + "users/me" : g + "users/users/" + id);
  const [tab, setTab] = useState("profile");
  const [edit, setEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState("");
  const removal = useAction();
  const u = d.data;
  const { list: tabs, ink } = useTabInk(tab, !!u);
  return (
    <>
      <Link className="back" href={self ? "/dashboard" : "/users"}>
        <ArrowLeft size={16} />
        {self ? "Volver al resumen" : "Todos los usuarios"}
      </Link>
      <State {...d} onRetry={d.reload}>
        <Heading title={u?.name || "Usuario"} description={u?.email || ""}>
          {role === "ADMIN" && (
            <button onClick={() => setEdit(true)}>Editar perfil</button>
          )}
        </Heading>
        <Notice text={notice} onDone={() => setNotice("")} />
        <div
          ref={tabs}
          className="tabs"
          role="tablist"
          aria-label="Información del usuario"
        >
          {[
            ["profile", "Perfil"],
            ["accounts", "Cuentas"],
            ...(role === "ADMIN" || self ? [["files", "Archivos"]] : []),
            ["activity", "Actividad"],
          ].map(([v, l]) => (
            <button
              key={v}
              role="tab"
              id={"tab-" + v}
              aria-controls={tab === v ? "panel-" + v : undefined}
              tabIndex={tab === v ? 0 : -1}
              onKeyDown={(event) => {
                if (
                  !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                    event.key,
                  )
                )
                  return;
                event.preventDefault();
                const nodes = Array.from(
                  event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>(
                    '[role="tab"]',
                  ),
                );
                const index = nodes.indexOf(event.currentTarget);
                const next =
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? nodes.length - 1
                      : (index +
                          (event.key === "ArrowRight" ? 1 : -1) +
                          nodes.length) %
                        nodes.length;
                nodes[next].click();
                nodes[next].focus();
              }}
              aria-selected={tab === v}
              onClick={() => setTab(v)}
            >
              {l}
            </button>
          ))}
          <span className="tab-ink" style={ink} aria-hidden="true" />
        </div>
        <AutoHeight>
          <div
            role="tabpanel"
            id={"panel-" + tab}
            aria-labelledby={"tab-" + tab}
            className="tab-panel"
            key={tab}
          >
            {tab === "profile" && u && (
              <section className="panel profile-panel">
                <dl>
                  <div>
                    <dt>Estado</dt>
                    <dd>
                      <Badge value={u.status} />
                    </dd>
                  </div>
                  <div>
                    <dt>Correo electrónico</dt>
                    <dd>{u.email}</dd>
                  </div>
                  <div>
                    <dt>Permisos</dt>
                    <dd>{labels[u.role]}</dd>
                  </div>
                  <div>
                    <dt>Identificador</dt>
                    <dd className="mono">{u.id}</dd>
                  </div>
                </dl>
                {self && (
                  <div className="preference">
                    <div>
                      <strong>Movimiento de la interfaz</strong>
                      <p className="muted">
                        Sistema sigue la preferencia de tu dispositivo.
                      </p>
                    </div>
                    <MotionControl />
                  </div>
                )}
                {role === "ADMIN" && !self && (
                  <div className="danger-zone">
                    <div>
                      <strong>Eliminar usuario</strong>
                      <p className="muted">
                        Elimina su registro y publica el evento correspondiente.
                      </p>
                    </div>
                    <button
                      className="danger"
                      onClick={() => setDeleting(true)}
                    >
                      Eliminar usuario
                    </button>
                  </div>
                )}
              </section>
            )}
            {tab === "accounts" && <Accounts owner={id} embedded />}
            {tab === "files" && <Files owner={id} embedded />}
            {tab === "activity" && <Notifications owner={id} embedded />}
          </div>
        </AutoHeight>
      </State>
      <Exit>
        {edit && u && (
          <UserForm
            user={u}
            onClose={() => setEdit(false)}
            onDone={() => {
              setEdit(false);
              setNotice(
                "Cambios guardados. La búsqueda se actualizará en unos segundos.",
              );
              d.reload();
            }}
          />
        )}
      </Exit>
      <Exit>
        {deleting && (
          <Modal
            title="¿Eliminar este usuario?"
            onClose={() => setDeleting(false)}
          >
            <p>
              Se eliminará el registro de {u?.name}. Esta acción no se puede
              deshacer.
            </p>
            {removal.error && (
              <p className="error" role="alert">
                {removal.error}
              </p>
            )}
            <div className="dialog-actions">
              <button
                disabled={removal.state !== "idle"}
                onClick={() => setDeleting(false)}
              >
                Cancelar
              </button>
              <Submit
                className="danger"
                state={removal.state}
                label="Eliminar definitivamente"
                busy="Eliminando…"
                done="Eliminado"
                onClick={() =>
                  removal.run(
                    () => api(g + "users/users/" + id, { method: "DELETE" }),
                    () => location.assign("/users"),
                  )
                }
              />
            </div>
          </Modal>
        )}
      </Exit>
    </>
  );
}
function Owner({
  value,
  onChange,
  all = false,
}: {
  value: string;
  onChange: (v: string) => void;
  all?: boolean;
}) {
  const users = useData<User[]>(g + "users/users");
  return (
    <label className="owner-select">
      Propietario
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">
          {all ? "Todos los usuarios" : "Selecciona un usuario"}
        </option>
        {list(users.data).map((u) => (
          <option key={u.id} value={u.id}>
            {u.name} · {u.email}
          </option>
        ))}
      </select>
      {users.error && <small className="error">{users.error}</small>}
    </label>
  );
}
export function Accounts({
  owner,
  embedded = false,
}: {
  owner?: string;
  embedded?: boolean;
}) {
  const { role, userId } = useActor();
  const [selected, setSelected] = useState(owner || userId);
  const own = role === "MEMBER";
  const d = useData<Account[]>(
    own
      ? g + "accounts/me"
      : g + "accounts/accounts?userId=" + (selected || userId),
  );
  const people = useData<User[]>(own ? null : g + "users/users");
  const [create, setCreate] = useState(false);
  const [notice, setNotice] = useState("");
  const action = useAction();
  const fresh = useFresh(d);
  const rows = list(d.data);
  const ownerName = (id: string) =>
    id === userId
      ? "Mi cuenta"
      : list(people.data).find((u) => u.id === id)?.name;
  return (
    <>
      <Heading
        level={embedded ? 2 : 1}
        title={embedded ? "Cuentas vinculadas" : "Cuentas"}
        description="Consulta las cuentas de ahorro y corrientes vinculadas a cada usuario."
      >
        <Reload run={d.reload} busy={d.loading} />
        {role === "ADMIN" && (
          <button className="primary" onClick={() => setCreate(true)}>
            <Plus size={17} />
            Abrir cuenta
          </button>
        )}
      </Heading>
      <Notice text={notice} onDone={() => setNotice("")} />
      <section className="panel">
        {!embedded && !own && (
          <div className="filters">
            <Owner value={selected} onChange={setSelected} />
          </div>
        )}
        <State
          {...d}
          empty={!rows.length}
          onRetry={d.reload}
          emptyTitle="Sin cuentas vinculadas"
          emptyText={
            role === "ADMIN"
              ? "Usa Abrir cuenta para crear la primera."
              : "Las cuentas abiertas aparecerán aquí."
          }
        >
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Cuenta</th>
                  <th>Tipo</th>
                  <th>Propietario</th>
                  <th>Apertura</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} data-fresh={fresh.has(a.id) || undefined}>
                    <td>
                      <div className="with-icon">
                        <Wallet size={18} />
                        <span className="mono">{a.id}</span>
                      </div>
                    </td>
                    <td data-label="Tipo">
                      <Badge value={a.accountType} />
                    </td>
                    <td
                      data-label="Propietario"
                      className={ownerName(a.userId) ? undefined : "mono"}
                    >
                      {ownerName(a.userId) || a.userId}
                    </td>
                    <td data-label="Apertura">{date(a.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </State>
      </section>
      <Exit>
        {create && (
          <Modal title="Abrir una cuenta" onClose={() => setCreate(false)}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                action.run(
                  () =>
                    api(
                      g + "accounts/accounts",
                      send("POST", {
                        userId: selected,
                        accountType: f.get("accountType"),
                      }),
                    ),
                  () => {
                    setCreate(false);
                    setNotice(
                      "Cuenta creada. La notificación se procesará en segundo plano.",
                    );
                    d.reload();
                  },
                );
              }}
            >
              <Owner value={selected} onChange={setSelected} />
              <label>
                Tipo de cuenta
                <select name="accountType">
                  <option value="SAVINGS">Ahorros</option>
                  <option value="CHECKING">Corriente</option>
                </select>
              </label>
              {action.error && (
                <p className="error" role="alert">
                  {action.error}
                </p>
              )}
              <div className="dialog-actions">
                <button type="button" onClick={() => setCreate(false)}>
                  Cancelar
                </button>
                <Submit
                  state={action.state}
                  disabled={!selected}
                  label="Abrir cuenta"
                  busy="Abriendo…"
                  done="Cuenta abierta"
                />
              </div>
            </form>
          </Modal>
        )}
      </Exit>
    </>
  );
}
export function Files({
  owner,
  embedded = false,
}: {
  owner?: string;
  embedded?: boolean;
}) {
  const { role, userId } = useActor();
  const [selected, setSelected] = useState(owner || userId);
  const [cursor, setCursor] = useState("");
  const [cursors, setCursors] = useState<string[]>([]);
  const d = useData<{ items: FileRef[]; nextCursor: string | null }>(
    g +
      "files/users/" +
      selected +
      "/files?limit=20" +
      (cursor ? "&after=" + cursor : ""),
  );
  const [target, setTarget] = useState<FileRef | null | undefined>(undefined);
  const [remove, setRemove] = useState<FileRef | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const removal = useAction();
  const fresh = useFresh(d);
  const operation = useRef({ identity: "", key: "" });
  const rows = list(d.data);
  const path = g + "files/users/" + selected + "/files";
  function upload(form: HTMLFormElement) {
    if (busy) return;
    setError("");
    const data = new FormData(form);
    const file = data.get("file");
    if (!(file instanceof File) || file.size > 10485760) {
      setError("Selecciona un archivo de hasta 10 MiB.");
      return;
    }
    setBusy(true);
    setProgress(0);
    const xhr = new XMLHttpRequest();
    xhr.open(target ? "PUT" : "POST", path + (target ? "/" + target.id : ""));
    const identity =
      selected +
      ":" +
      (target?.id || "new") +
      ":" +
      file.name +
      ":" +
      file.size +
      ":" +
      file.lastModified;
    if (operation.current.identity !== identity)
      operation.current = { identity, key: crypto.randomUUID() };
    xhr.setRequestHeader("Idempotency-Key", operation.current.key);
    if (target) xhr.setRequestHeader("If-Match", target.revision);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable)
        setProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onerror = () => {
      setError("No se pudo conectar. Intenta nuevamente.");
      setBusy(false);
      setProgress(null);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        operation.current = { identity: "", key: "" };
        setProgress(100);
        setSaved(true);
        d.reload();
        setTimeout(
          () => {
            setTarget(undefined);
            setBusy(false);
            setProgress(null);
            setSaved(false);
            setNotice(
              target ? "Archivo reemplazado." : "Archivo subido correctamente.",
            );
          },
          motionReduced() ? 0 : 560,
        );
      } else {
        setBusy(false);
        setProgress(null);
        let message = "No pudimos subir el archivo.";
        try {
          message = JSON.parse(xhr.responseText).message;
        } catch {}
        setError(message);
        if (xhr.status === 401) location.assign("/login");
      }
    };
    xhr.send(data);
  }
  return (
    <>
      <Heading
        level={embedded ? 2 : 1}
        title="Archivos"
        description="Documentos privados, organizados por usuario. PDF, PNG y JPEG hasta 10 MiB."
      >
        <Reload run={d.reload} busy={d.loading} />
        <button
          className="primary"
          onClick={() => {
            setError("");
            setTarget(null);
          }}
        >
          <Upload size={17} />
          Subir archivo
        </button>
      </Heading>
      <Notice text={notice} onDone={() => setNotice("")} />
      {error && target === undefined && !remove && (
        <p className="error page-error" role="alert">
          {error}
        </p>
      )}
      <section className="panel">
        {!embedded && role === "ADMIN" && (
          <div className="filters">
            <Owner
              value={selected}
              onChange={(v) => {
                if (v) {
                  setSelected(v);
                  setCursor("");
                  setCursors([]);
                }
              }}
            />
          </div>
        )}
        <State
          {...d}
          empty={!rows.length}
          onRetry={d.reload}
          emptyTitle="Todavía no hay archivos"
          emptyText="Usa Subir archivo para agregar un PDF, PNG o JPEG."
        >
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Archivo</th>
                  <th>Tamaño</th>
                  <th>Actualizado</th>
                  <th className="end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((f) => (
                  <tr key={f.id} data-fresh={fresh.has(f.id) || undefined}>
                    <td>
                      <div className="person">
                        <span className="file-icon">
                          <FileText size={20} />
                        </span>
                        <span>
                          <strong>{f.name}</strong>
                          <small>{f.mime}</small>
                        </span>
                      </div>
                    </td>
                    <td data-label="Tamaño">
                      {new Intl.NumberFormat("es-CO", {
                        maximumFractionDigits: 1,
                      }).format(f.size < 1024 ? f.size : f.size / 1024)}{" "}
                      {f.size < 1024 ? "B" : "KiB"}
                    </td>
                    <td data-label="Actualizado">{date(f.updatedAt)}</td>
                    <td className="end">
                      <div className="actions">
                        <a
                          className="button icon"
                          onClick={async (e) => {
                            e.preventDefault();
                            setError("");
                            try {
                              const response = await fetch(
                                e.currentTarget.href,
                                { cache: "no-store" },
                              );
                              if (!response.ok) {
                                const data = await response.json();
                                throw new Error(
                                  data.message ||
                                    "No pudimos descargar el archivo.",
                                );
                              }
                              const objectUrl = URL.createObjectURL(
                                await response.blob(),
                              );
                              const link = document.createElement("a");
                              link.href = objectUrl;
                              link.download = f.name;
                              link.click();
                              setTimeout(
                                () => URL.revokeObjectURL(objectUrl),
                                1000,
                              );
                            } catch (error) {
                              setError((error as Error).message);
                            }
                          }}
                          title={"Descargar " + f.name}
                          aria-label={"Descargar " + f.name}
                          href={
                            "/api/download?userId=" +
                            selected +
                            "&fileId=" +
                            f.id
                          }
                        >
                          <Download size={17} />
                        </a>
                        <button
                          onClick={() => {
                            setError("");
                            setTarget(f);
                          }}
                        >
                          Reemplazar
                        </button>
                        <button
                          className="icon danger"
                          aria-label={"Eliminar " + f.name}
                          onClick={() => {
                            setError("");
                            setRemove(f);
                          }}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </State>
        {(cursor || d.data?.nextCursor) && (
          <div className="pager">
            <PagerButtons
              previous={!!cursor}
              next={!!d.data?.nextCursor}
              onPrevious={() => {
                setCursor(cursors.at(-1) || "");
                setCursors(cursors.slice(0, -1));
              }}
              onNext={() => {
                setCursors([...cursors, cursor]);
                setCursor(d.data!.nextCursor!);
              }}
            />
          </div>
        )}
      </section>
      <Exit>
        {target !== undefined && (
          <Modal
            title={target ? "Reemplazar archivo" : "Subir un archivo"}
            onClose={() => {
              if (!busy) setTarget(undefined);
            }}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                upload(e.currentTarget);
              }}
            >
              <label className="upload-zone">
                <Upload size={28} />
                <strong>
                  {target
                    ? "Selecciona la nueva versión"
                    : "Selecciona un documento"}
                </strong>
                <span>PDF, PNG o JPEG · Máximo 10 MiB</span>
                <input
                  name="file"
                  type="file"
                  accept="application/pdf,image/png,image/jpeg"
                  required
                  disabled={busy}
                />
              </label>
              {target && (
                <p className="hint">
                  Se comprobará la versión actual antes de guardar el reemplazo.
                </p>
              )}
              {progress !== null && (
                <div
                  className="upload-progress"
                  data-state={
                    saved
                      ? "saved"
                      : progress === 100
                        ? "processing"
                        : "sending"
                  }
                >
                  <div
                    className="upload-bar"
                    role="progressbar"
                    aria-label="Progreso de la carga"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progress}
                  >
                    <span style={{ transform: `scaleX(${progress / 100})` }} />
                  </div>
                  <p className="hint" role="status">
                    {saved && <Check size={15} />}
                    {saved
                      ? "Archivo guardado"
                      : progress === 100
                        ? "Procesando archivo…"
                        : `Subiendo ${progress}%`}
                  </p>
                </div>
              )}
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <div className="dialog-actions">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setTarget(undefined)}
                >
                  Cancelar
                </button>
                <Submit
                  state={saved ? "done" : busy ? "busy" : "idle"}
                  label={target ? "Guardar reemplazo" : "Subir archivo"}
                  busy="Guardando…"
                  done="Guardado"
                />
              </div>
            </form>
          </Modal>
        )}
      </Exit>
      <Exit>
        {remove && (
          <Modal
            title="¿Eliminar este archivo?"
            onClose={() => setRemove(null)}
          >
            <p>Se eliminarán las versiones almacenadas de {remove.name}.</p>
            {removal.error && (
              <p role="alert" className="error">
                {removal.error}
              </p>
            )}
            <div className="dialog-actions">
              <button
                disabled={removal.state !== "idle"}
                onClick={() => setRemove(null)}
              >
                Cancelar
              </button>
              <Submit
                className="danger"
                state={removal.state}
                label="Eliminar archivo"
                busy="Eliminando…"
                done="Eliminado"
                onClick={() => {
                  let pending = false;
                  removal.run(
                    async () => {
                      pending = Boolean(
                        await api(path + "/" + remove.id, { method: "DELETE" }),
                      );
                    },
                    () => {
                      setNotice(
                        pending
                          ? "Eliminación en proceso. Actualiza la lista en unos segundos."
                          : "Archivo eliminado.",
                      );
                      setRemove(null);
                      d.reload();
                    },
                  );
                }}
              />
            </div>
          </Modal>
        )}
      </Exit>
    </>
  );
}
export function Search() {
  const { role } = useActor();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("users");
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(q);
      setOffset(0);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);
  const d = useData(
    g +
      "search/" +
      kind +
      "?" +
      new URLSearchParams({ q: query, limit: "20", offset: String(offset) }),
    true,
  );
  const rows = list(d.data);
  return (
    <>
      <Heading
        title="Búsqueda"
        description="Encuentra usuarios y cuentas en el índice de búsqueda."
      >
        <Reload run={d.reload} busy={d.loading} />
      </Heading>
      <section className="panel">
        <div className="search-toolbar">
          <label className="search-input">
            <SearchIcon size={19} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Buscar en el sistema"
              placeholder="Escribe un nombre, correo o identificador"
            />
          </label>
          <div className="segmented">
            {[
              ["users", "Usuarios"],
              ["accounts", "Cuentas"],
            ].map(([v, l]) => (
              <button
                key={v}
                aria-pressed={kind === v}
                onClick={() => {
                  setKind(v);
                  setOffset(0);
                }}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <p className="index-note">
          <span className="local-dot" />
          Resultados indexados · Los cambios recientes pueden tardar unos
          segundos.
        </p>
        <State
          {...d}
          empty={!rows.length}
          onRetry={d.reload}
          emptyTitle={
            query ? `Sin coincidencias para “${query}”` : "El índice está vacío"
          }
          emptyText={
            query
              ? "Revisa el texto o cambia entre usuarios y cuentas."
              : "Los registros aparecerán aquí cuando se indexen."
          }
        >
          <div className="search-results">
            {rows.map((x: any) => (
              <article key={x.id}>
                <div className="file-icon">
                  {kind === "users" ? (
                    <UserRound size={20} />
                  ) : (
                    <Wallet size={20} />
                  )}
                </div>
                <div>
                  <h3>
                    {role === "MEMBER" ? (
                      x.name || labels[x.accountType] || x.id
                    ) : (
                      <Link
                        className="result-link"
                        href={"/users/" + (x.userId || x.id)}
                      >
                        {x.name || labels[x.accountType] || x.id}
                      </Link>
                    )}
                  </h3>
                  <p className="muted">{x.email || x.userId}</p>
                  <small className="mono">{x.id}</small>
                </div>
                {x.status && <Badge value={x.status} />}
              </article>
            ))}
          </div>
          <Pager
            offset={offset}
            total={d.data?.total || 0}
            onChange={setOffset}
          />
        </State>
      </section>
    </>
  );
}
export function Notifications({
  owner,
  embedded = false,
}: {
  owner?: string;
  embedded?: boolean;
}) {
  const { role } = useActor();
  const [status, setStatus] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState(owner || "");
  const params = new URLSearchParams({ limit: "20", offset: String(offset) });
  if (status) params.set("status", status);
  if (selected) params.set("userId", selected);
  const d = useData(g + "notifications/history?" + params, true);
  const fresh = useFresh(d);
  const rows = list(d.data);
  return (
    <>
      <Heading
        level={embedded ? 2 : 1}
        title="Notificaciones"
        description="Seguimiento del procesamiento de las notificaciones por evento."
      >
        <Reload run={d.reload} busy={d.loading} />
      </Heading>
      <section className="panel">
        <div className="filters">
          {!embedded && role !== "MEMBER" && (
            <Owner
              all
              value={selected}
              onChange={(v) => {
                setSelected(v);
                setOffset(0);
              }}
            />
          )}
          <label>
            Estado
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setOffset(0);
              }}
            >
              <option value="">Todos los estados</option>
              {["PENDING", "SENT", "FAILED"].map((s) => (
                <option value={s} key={s}>
                  {labels[s]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <State
          {...d}
          empty={!rows.length}
          onRetry={d.reload}
          emptyTitle={
            status || (selected && !embedded)
              ? "Sin notificaciones con estos filtros"
              : "Todavía no hay notificaciones"
          }
          emptyText={
            status || (selected && !embedded)
              ? "Cambia el estado o el propietario para ver otros eventos."
              : "Los eventos procesados aparecerán aquí."
          }
        >
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Evento</th>
                  <th>Estado</th>
                  <th>Registro</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((n: any) => (
                  <tr key={n.id} data-fresh={fresh.has(n.id) || undefined}>
                    <td className="stacked">
                      <strong>{n.eventName}</strong>
                      <small className="mono">{n.userId}</small>
                    </td>
                    <td data-label="Estado">
                      <Badge value={n.status} />
                    </td>
                    <td data-label="Registro">{date(n.updatedAt)}</td>
                    <td
                      data-label="Detalle"
                      className={n.failureCode ? "mono" : "mono no-value"}
                    >
                      {n.failureCode || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager
            offset={offset}
            total={d.data?.total || 0}
            onChange={setOffset}
          />
        </State>
      </section>
      <p className="hint">
        En Dev, los correos se procesan con un proveedor local de prueba.
      </p>
    </>
  );
}
export function Dashboard() {
  const { role, userId } = useActor();
  const me = useData<User>(g + "users/me");
  const users = useData(role === "MEMBER" ? null : g + "users/users");
  const accounts = useData(
    role === "MEMBER"
      ? g + "accounts/me"
      : g + "accounts/accounts?userId=" + userId,
  );
  const files = useData(g + "files/users/" + userId + "/files");
  const notifications = useData(g + "notifications/history?limit=5");
  const stats = [
    {
      label: role === "MEMBER" ? "Mi perfil" : "Usuarios",
      value: role === "MEMBER" ? "01" : list(users.data).length,
      loading: role === "MEMBER" ? me.loading : users.loading,
      error: role === "MEMBER" ? me.error : users.error,
      icon: UserRound,
      href: role === "MEMBER" ? "/profile" : "/users",
      caption: "Identidad y permisos",
    },
    {
      label: "Mis cuentas",
      value: list(accounts.data).length,
      loading: accounts.loading,
      error: accounts.error,
      icon: Wallet,
      href: "/accounts",
      caption: "Vinculadas a usuarios",
    },
    {
      label: "Mis archivos",
      value: list(files.data).length,
      loading: files.loading,
      error: files.error,
      icon: FileText,
      href: "/files",
      caption: "Documentos privados",
    },
  ];
  return (
    <>
      <Heading
        title={
          me.data
            ? "Hola, " + me.data.name.split(" ")[0]
            : "Tu espacio de trabajo"
        }
        description="Una vista clara de las personas y operaciones de tu plataforma."
      />
      <div className="welcome-strip">
        <span className="local-dot" />
        <strong>Entorno de desarrollo</strong>
        <p>Datos artificiales y servicios locales conectados.</p>
      </div>
      <section className="stats">
        {stats.map((s) => (
          <Link href={s.href} key={s.label}>
            <div className="stat-top">
              <s.icon size={19} />
              <ArrowUpRight size={17} />
            </div>
            <p>{s.label}</p>
            <strong>
              {s.error ? (
                "—"
              ) : s.loading ? (
                <span className="skeleton w-stat" role="status">
                  <span className="visually-hidden">Cargando</span>
                </span>
              ) : (
                String(s.value).padStart(2, "0")
              )}
            </strong>
            <small className={s.error ? "stat-error" : undefined}>
              {s.error ? "Sin conexión" : s.caption}
            </small>
          </Link>
        ))}
      </section>
      <div className="dashboard-columns">
        <section className="panel">
          <div className="section-heading">
            <h2>Actividad reciente</h2>
            <Link href="/notifications" className="text-link">
              Ver todas
              <ArrowUpRight size={15} />
            </Link>
          </div>
          <State
            {...notifications}
            empty={!list(notifications.data).length}
            onRetry={notifications.reload}
            emptyTitle="Todavía no hay actividad"
            emptyText="Los eventos procesados aparecerán aquí."
          >
            <div className="activity-list">
              {list(notifications.data).map((n: any) => (
                <article key={n.id}>
                  <div>
                    <strong>{n.eventName}</strong>
                    <small>{date(n.updatedAt)}</small>
                  </div>
                  <Badge value={n.status} />
                </article>
              ))}
            </div>
          </State>
        </section>
        <section className="panel shortcuts">
          <div className="section-heading">
            <h2>Tu siguiente operación</h2>
          </div>
          <Link href="/search">
            <SearchIcon size={19} />
            <span>
              <strong>Buscar en la plataforma</strong>
              <small>Usuarios y cuentas indexados</small>
            </span>
            <ArrowUpRight size={16} />
          </Link>
          <Link href="/files">
            <Upload size={19} />
            <span>
              <strong>Gestionar documentos</strong>
              <small>Sube y consulta tus archivos</small>
            </span>
            <ArrowUpRight size={16} />
          </Link>
          <Link href="/profile">
            <UserRound size={19} />
            <span>
              <strong>Revisar mi perfil</strong>
              <small>Datos de acceso y permisos</small>
            </span>
            <ArrowUpRight size={16} />
          </Link>
        </section>
      </div>
      <footer className="workspace-footer">
        <span>
          <CheckCircle2 size={14} />
          Sesión protegida
        </span>
        <span>Gestión · Desarrollo local</span>
      </footer>
    </>
  );
}
export function Profile() {
  const { userId } = useActor();
  return <UserDetail id={userId} self />;
}
