"use client";
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  CSSProperties,
  ReactNode,
} from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Inbox,
  LoaderCircle,
  X,
} from "lucide-react";
import { api, labels } from "@/lib/client";
import {
  motionReduced,
  setMotionMode,
  useMotionMode,
  MotionMode,
} from "@/lib/motion";
export const list = (d: any): any[] =>
  Array.isArray(d) ? d : d?.items || d?.entries || d?.results || [];
export function useData<T = any>(url: string | null, keep = false) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [source, setSource] = useState<string | null>(null);
  const shown = useRef(url);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    if (!keep && shown.current !== url) setData(null);
    shown.current = url;
    if (!url) {
      setData(null);
      setLoading(false);
      return;
    }
    api<T>(url)
      .then((x) => {
        if (current) {
          setData(x);
          setSource(url);
        }
      })
      .catch((e) => {
        if (current) setError(e.message);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [url, tick, keep]);
  return { data, error, loading, source, reload: () => setTick((n) => n + 1) };
}
// Ids de los registros nuevos o modificados en la última actualización de una
// misma consulta. Cambiar de filtro o de página no cuenta como modificación.
export function useFresh(d: { data: unknown; source: string | null }) {
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const seen = useRef<{ source: string | null; rows: Map<string, string> }>(
    null,
  );
  useEffect(() => {
    if (d.data == null) return;
    const rows = new Map<string, string>(
      list(d.data).map((r) => [r.id, JSON.stringify(r)]),
    );
    const before = seen.current;
    seen.current = { source: d.source, rows };
    if (before?.source !== d.source) return;
    const changed = [...rows].filter(([id, v]) => before.rows.get(id) !== v);
    if (!changed.length) return;
    setFresh(new Set(changed.map(([id]) => id)));
    const t = setTimeout(() => setFresh(new Set()), 1800);
    return () => clearTimeout(t);
  }, [d.data, d.source]);
  return fresh;
}
type ActionState = "idle" | "busy" | "done";
// Una operación a la vez: bloquea el reenvío antes de que React vuelva a pintar
// y deja ver la confirmación un instante antes de continuar.
export function useAction() {
  const [state, setState] = useState<ActionState>("idle");
  const [error, setError] = useState("");
  const locked = useRef(false);
  const run = async (task: () => Promise<unknown>, then: () => void) => {
    if (locked.current) return;
    locked.current = true;
    setState("busy");
    setError("");
    try {
      await task();
      setState("done");
      setTimeout(
        () => {
          then();
          locked.current = false;
          setState("idle");
        },
        motionReduced() ? 0 : 320,
      );
    } catch (e) {
      setError((e as Error).message);
      setState("idle");
      locked.current = false;
    }
  };
  return { state, error, run };
}
export function Submit({
  state,
  label,
  busy,
  done,
  className = "primary",
  disabled,
  onClick,
}: {
  state: ActionState;
  label: string;
  busy: string;
  done: string;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      className={className + " action"}
      data-state={state}
      disabled={disabled || state !== "idle"}
      type={onClick ? "button" : "submit"}
      onClick={onClick}
    >
      <span className="action-label" key={state}>
        {state === "busy" && <LoaderCircle size={16} className="spin" />}
        {state === "done" && <Check size={16} />}
        {state === "busy" ? busy : state === "done" ? done : label}
      </span>
    </button>
  );
}
// Mantiene lo último renderizado mientras dura su salida: {open && <Modal />}
// sigue funcionando igual y Modal y Notice animan su cierre.
const Closing = createContext(false);
export function Exit({ children }: { children: ReactNode }) {
  const kept = useRef<ReactNode>(null);
  const [, refresh] = useState(0);
  if (children) kept.current = children;
  const leaving = !children && kept.current != null;
  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(
      () => {
        kept.current = null;
        refresh((n) => n + 1);
      },
      motionReduced() ? 0 : 130,
    );
    return () => clearTimeout(t);
  }, [leaving]);
  return <Closing.Provider value={leaving}>{kept.current}</Closing.Provider>;
}
export function useTabInk(active: string, ready: boolean) {
  const list = useRef<HTMLDivElement>(null);
  const [ink, setInk] = useState<CSSProperties>({ opacity: 0 });
  useLayoutEffect(() => {
    const measure = () => {
      const tab = list.current?.querySelector<HTMLElement>(
        '[aria-selected="true"]',
      );
      if (tab)
        setInk({
          width: tab.offsetWidth,
          transform: `translateX(${tab.offsetLeft}px)`,
        });
    };
    measure();
    addEventListener("resize", measure);
    return () => removeEventListener("resize", measure);
  }, [active, ready]);
  return { list, ink };
}
// Anima la altura del contenedor para que cambiar de pestaña no empuje la página
export function AutoHeight({ children }: { children: ReactNode }) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>();
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setHeight(entry.borderBoxSize[0].blockSize),
    );
    observer.observe(inner.current!);
    return () => observer.disconnect();
  }, []);
  return (
    <div className="auto-height" style={{ height }}>
      <div ref={inner}>{children}</div>
    </div>
  );
}
const MOTION: [MotionMode, string][] = [
  ["full", "Completo"],
  ["reduced", "Reducido"],
  ["system", "Sistema"],
];
export function MotionControl() {
  const mode = useMotionMode();
  return (
    <div className="segmented" role="group" aria-label="Movimiento">
      {MOTION.map(([value, label]) => (
        <button
          key={value}
          type="button"
          aria-pressed={mode === value}
          onClick={() => setMotionMode(value)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
export function Heading({
  level = 1,
  title,
  description,
  children,
}: {
  level?: 1 | 2;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {level === 1 ? <h1>{title}</h1> : <h2>{title}</h2>}
        <p className="muted">{description}</p>
      </div>
      <div className="actions">{children}</div>
    </div>
  );
}
export function Badge({ value }: { value: string }) {
  return (
    <span
      className={
        "badge " +
        (["ACTIVE", "SENT"].includes(value)
          ? "good"
          : ["FAILED", "BLOCKED", "INACTIVE"].includes(value)
            ? "bad"
            : value === "PENDING"
              ? "warn"
              : "")
      }
    >
      {labels[value] || value}
    </span>
  );
}
function Skeleton() {
  return (
    <div className="skeleton-list" role="status">
      <span className="visually-hidden">Cargando datos…</span>
      {[0, 1, 2].map((n) => (
        <div className="skeleton-row" key={n} aria-hidden="true">
          <span className="skeleton dot" />
          <div>
            <span className="skeleton w-title" />
            <span className="skeleton w-text" />
          </div>
          <span className="skeleton w-badge" />
        </div>
      ))}
    </div>
  );
}
export function State({
  data,
  loading,
  error,
  empty,
  emptyTitle = "Todavía no hay registros",
  emptyText = "Los nuevos registros aparecerán aquí.",
  emptyAction,
  onRetry,
  children,
}: {
  data?: unknown;
  loading: boolean;
  error: string;
  empty?: boolean;
  emptyTitle?: string;
  emptyText?: string;
  emptyAction?: ReactNode;
  onRetry: () => void;
  children: ReactNode;
}) {
  if (loading && data == null) return <Skeleton />;
  // Si falla una actualización, los datos ya cargados siguen a la vista
  if (error && data != null)
    return (
      <>
        <div className="stale" role="alert">
          <AlertTriangle size={16} />
          <span>{error}</span>
          <button onClick={onRetry}>Intentar nuevamente</button>
        </div>
        <div className="state-content">{children}</div>
      </>
    );
  if (error)
    return (
      <div className="empty failed" role="alert">
        <AlertTriangle size={26} />
        <p>{error}</p>
        <button onClick={onRetry}>Intentar nuevamente</button>
      </div>
    );
  if (empty)
    return (
      <div className="empty">
        <Inbox size={28} />
        <h3>{emptyTitle}</h3>
        <p>{emptyText}</p>
        {emptyAction}
      </div>
    );
  return (
    <div className="state-content" aria-busy={loading}>
      {children}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const closing = useContext(Closing);
  useEffect(() => {
    const d = ref.current!;
    const opener = document.activeElement as HTMLElement | null;
    d.showModal();
    return () => {
      d.close();
      if (opener?.isConnected) opener.focus();
      else document.getElementById("content")?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      data-closing={closing || undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-body">
        <div className="dialog-heading">
          <h2>{title}</h2>
          <button
            type="button"
            className="icon"
            aria-label="Cerrar"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
function Toast({ text, onDone }: { text: string; onDone: () => void }) {
  const closing = useContext(Closing);
  const [held, setHeld] = useState(false);
  const finish = useRef(onDone);
  finish.current = onDone;
  useEffect(() => {
    if (held || closing) return;
    const t = setTimeout(() => finish.current(), 7000);
    return () => clearTimeout(t);
  }, [held, closing, text]);
  return (
    <div
      className="notice"
      data-closing={closing || undefined}
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      <CheckCircle2 size={16} />
      <p>{text}</p>
      <button
        type="button"
        className="icon"
        aria-label="Cerrar aviso"
        onClick={onDone}
      >
        <X size={15} />
      </button>
    </div>
  );
}
// Flota sobre la página para no desplazar el contenido. La región viva existe
// siempre: así el lector de pantalla anuncia cada aviso nuevo.
export function Notice({ text, onDone }: { text: string; onDone: () => void }) {
  return (
    <div className="toasts" role="status">
      <Exit>{text && <Toast text={text} onDone={onDone} />}</Exit>
    </div>
  );
}
export function Pager({
  offset,
  total,
  onChange,
}: {
  offset: number;
  total: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="pager">
      <span>
        {total
          ? `${offset + 1}–${Math.min(offset + 20, total)} de ${total}`
          : "0 resultados"}
      </span>
      {total > 20 && (
        <PagerButtons
          previous={offset > 0}
          next={offset + 20 < total}
          onPrevious={() => onChange(Math.max(0, offset - 20))}
          onNext={() => onChange(offset + 20)}
        />
      )}
    </div>
  );
}
export function PagerButtons({
  previous,
  next,
  onPrevious,
  onNext,
}: {
  previous: boolean;
  next: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <>
      <button
        aria-label="Página anterior"
        disabled={!previous}
        onClick={onPrevious}
      >
        <ArrowLeft size={16} />
      </button>
      <button aria-label="Página siguiente" disabled={!next} onClick={onNext}>
        <ArrowRight size={16} />
      </button>
    </>
  );
}
