"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useRef, createContext, useContext } from "react";
import {
  LayoutDashboard,
  Users,
  Wallet,
  Files,
  Search,
  Bell,
  UserCircle,
  LogOut,
  Menu,
  X,
  Layers3,
} from "lucide-react";
import { api, labels } from "@/lib/client";
const Context = createContext({ role: "MEMBER", userId: "", demoMode: false });
export const useActor = () => useContext(Context);
const nav = [
  ["/dashboard", "Resumen", LayoutDashboard],
  ["/users", "Usuarios", Users],
  ["/accounts", "Cuentas", Wallet],
  ["/files", "Archivos", Files],
  ["/search", "Búsqueda", Search],
  ["/notifications", "Notificaciones", Bell],
  ["/profile", "Mi perfil", UserCircle],
] as const;
export function Shell({
  children,
  role,
  userId,
  demoMode = false,
}: {
  children: React.ReactNode;
  role: string;
  userId: string;
  demoMode?: boolean;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const sidebar = useRef<HTMLElement>(null);
  const menu = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const q = matchMedia("(max-width:760px)");
    const change = () => setMobile(q.matches);
    change();
    q.addEventListener("change", change);
    return () => q.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    if (!open || !mobile) return;
    sidebar.current?.querySelector<HTMLElement>("a")?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        menu.current?.focus();
      }
      if (e.key === "Tab") {
        const nodes = Array.from(
          sidebar.current?.querySelectorAll<HTMLElement>("a,button") || [],
        );
        const first = nodes[0],
          last = nodes.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, mobile]);
  const [name, setName] = useState("");
  useEffect(() => {
    api("/api/auth/session")
      .then((x) => setName(x.user.name))
      .catch(() => {});
  }, []);
  useEffect(() => setOpen(false), [path]);
  const section = nav.find((n) => path.startsWith(n[0]));
  const detail = path.startsWith("/users/");
  return (
    <Context.Provider value={{ role, userId, demoMode }}>
      <a href="#content" className="skip">
        Ir al contenido
      </a>
      <div className="workspace">
        <aside
          ref={sidebar}
          inert={mobile && !open}
          className={open ? "sidebar open" : "sidebar"}
        >
          <Link href="/dashboard" className="brand">
            <Layers3 /> Gestión
          </Link>
          <p className="nav-label">ESPACIO DE TRABAJO</p>
          <nav aria-label="Navegación principal">
            {nav
              .filter((n) => n[0] !== "/users" || role !== "MEMBER")
              .map(([url, label, Icon]) => (
                <Link
                  key={url}
                  href={url}
                  aria-current={path.startsWith(url) ? "page" : undefined}
                >
                  <Icon size={18} />
                  {label}
                  {path.startsWith(url) && <i />}
                </Link>
              ))}
          </nav>
          <div className="sidebar-bottom">
            <span className="local-dot" /> Entorno local
            <div className="identity">
              <div className="avatar">{name.slice(0, 1)}</div>
              <div>
                <strong title={name}>{name || "Mi cuenta"}</strong>
                <small>{labels[role]}</small>
              </div>
              <button
                className="icon"
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
                onClick={async () => {
                  await api("/api/auth/logout", { method: "POST" });
                  location.assign("/login");
                }}
              >
                <LogOut size={17} />
              </button>
            </div>
          </div>
        </aside>
        {open && (
          <button
            className="scrim"
            aria-label="Cerrar menú"
            onClick={() => setOpen(false)}
          />
        )}
        <div className="main">
          <header className="topbar">
            <button
              ref={menu}
              className="icon mobile-menu"
              aria-label={open ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={open}
              onClick={() => setOpen(!open)}
            >
              {open ? <X /> : <Menu />}
            </button>
            <nav className="crumbs" aria-label="Ruta actual">
              <span className="crumb-root">Gestión</span>
              <span className="slash" aria-hidden="true">
                /
              </span>
              {detail ? (
                <>
                  <Link href="/users">Usuarios</Link>
                  <span className="slash" aria-hidden="true">
                    /
                  </span>
                  <span aria-current="page">Detalle</span>
                </>
              ) : (
                <span aria-current="page">{section?.[1]}</span>
              )}
            </nav>
            <div className="top-right">
              {demoMode && <span className="dev-badge">DESARROLLO</span>}
              <Link href="/profile" className="avatar" aria-label="Mi perfil">
                {name.slice(0, 1)}
              </Link>
            </div>
          </header>
          <main id="content" className="content">
            {children}
          </main>
        </div>
      </div>
    </Context.Provider>
  );
}
