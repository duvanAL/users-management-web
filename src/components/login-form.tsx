"use client";
import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { api, ApiError, send } from "@/lib/client";
import { MotionControl } from "@/components/ui";
import {
  BrandMark,
  LoginNetwork,
  LoginPhase,
} from "@/components/login-network";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  Fingerprint,
  ShieldCheck,
  FileText,
  Users,
  Wallet,
} from "lucide-react";

const SUBMIT: Record<LoginPhase, string> = {
  idle: "Iniciar sesión",
  error: "Iniciar sesión",
  busy: "Validando sesión…",
  done: "Sesión iniciada",
};

export type DemoAccount = { role: string; email: string; password: string };

export default function Login({
  demoAccounts = [],
}: {
  demoAccounts?: DemoAccount[];
}) {
  const [error, setError] = useState("");
  const [rejected, setRejected] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [phase, setPhase] = useState<LoginPhase>("idle");
  const [fields, setFields] = useState({ email: false, password: false });
  const form = useRef<HTMLFormElement>(null);
  const password = useRef<HTMLInputElement>(null);
  const submitButton = useRef<HTMLButtonElement>(null);

  const readFields = () => {
    const f = form.current;
    if (!f) return;
    const valid = (name: string) => {
      const input = f.elements.namedItem(name) as HTMLInputElement;
      return input.value !== "" && input.validity.valid;
    };
    setFields({ email: valid("email"), password: valid("password") });
  };

  const clearFailure = () => {
    setError("");
    setRejected(false);
    if (phase === "error") setPhase("idle");
  };

  const fillDemo = (demo: DemoAccount) => {
    const f = form.current;
    if (!f) return;
    (f.elements.namedItem("email") as HTMLInputElement).value = demo.email;
    (f.elements.namedItem("password") as HTMLInputElement).value =
      demo.password;
    readFields();
    clearFailure();
    submitButton.current?.focus();
  };

  const readCapsLock = (e: KeyboardEvent<HTMLInputElement>) =>
    setCapsLock(e.getModifierState("CapsLock"));

  useEffect(() => {
    // El gestor de contraseñas puede rellenar el formulario sin emitir input
    const autofill = setTimeout(readFields, 350);
    // Volver atrás desde el panel restaura la página tal como quedó al salir
    const restored = (e: PageTransitionEvent) => {
      if (e.persisted) setPhase("idle");
    };
    addEventListener("pageshow", restored);
    return () => {
      clearTimeout(autofill);
      removeEventListener("pageshow", restored);
    };
  }, []);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPhase("busy");
    setError("");
    setRejected(false);
    const f = new FormData(e.currentTarget);
    try {
      await api("/api/auth/login", send("POST", Object.fromEntries(f)));
      setPhase("done");
      location.assign("/dashboard");
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
      // Un 429 o una caída de red no dicen nada sobre lo que se escribió.
      const status = e instanceof ApiError ? e.status : 0;
      if (status === 400 || status === 401) {
        setRejected(true);
        password.current?.focus();
        password.current?.select();
      }
    }
  };

  const lit =
    phase === "done" ? 3 : Number(fields.email) + Number(fields.password);
  const locked = phase === "busy" || phase === "done";
  const invalid = rejected
    ? ({ "aria-invalid": true, "aria-describedby": "login-error" } as const)
    : {};

  return (
    <main className="login login-immersive" data-lit={lit} data-phase={phase}>
      <header className="login-masthead">
        <a className="brand" href="/">
          <BrandMark /> Gestión{demoAccounts.length > 0 && <span>DEV</span>}
        </a>
        <span className="login-environment">
          {demoAccounts.length > 0 ? "Entorno de desarrollo" : "Acceso seguro"}
        </span>
      </header>
      <section className="login-universe" aria-label="Tu plataforma conectada">
        <div className="login-artwork" aria-hidden="true">
          <LoginNetwork
            lit={lit}
            phase={phase}
            links={[fields.email, fields.password, locked]}
          />
          <div className="login-core-label">
            <Fingerprint size={30} />
            <span>GESTIÓN</span>
          </div>
          <div className="orbit-label orbit-users" data-on={fields.email}>
            <Users size={15} />
            <span>Usuarios</span>
            <i />
          </div>
          <div className="orbit-label orbit-accounts" data-on={fields.password}>
            <Wallet size={15} />
            <span>Cuentas</span>
            <i />
          </div>
          <div className="orbit-label orbit-files" data-on={locked}>
            <FileText size={15} />
            <span>Archivos</span>
            <i />
          </div>
        </div>
        <div className="login-narrative">
          <p className="login-kicker">
            <span />
            CADA PARTE, CONECTADA
          </p>
          <h1>
            Tu mundo.
            <br />
            <span>En un solo lugar.</span>
          </h1>
          <p>
            Personas, cuentas y documentos.
            <br />
            Todo fluye desde aquí.
          </p>
        </div>
      </section>
      <section className="login-access-area" aria-labelledby="login-heading">
        <div className="login-access">
          <div className="login-entry-icon">
            <ShieldCheck size={22} />
          </div>
          <h2 id="login-heading">Bienvenido de nuevo</h2>
          <p className="login-access-description">
            Ingresa y continúa donde lo dejaste.
          </p>
          <form
            ref={form}
            onSubmit={submit}
            onInput={() => {
              readFields();
              clearFailure();
            }}
          >
            <label>
              Correo electrónico
              <span className="login-field" data-ok={fields.email && !rejected}>
                <input
                  name="email"
                  type="email"
                  autoComplete="username"
                  placeholder="tu@correo.com"
                  required
                  {...invalid}
                />
                <FieldCheck />
              </span>
            </label>
            <label>
              Contraseña
              <span
                className="login-field with-toggle"
                data-ok={fields.password && !rejected}
              >
                <input
                  ref={password}
                  name="password"
                  aria-label="Contraseña"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  minLength={8}
                  onKeyDown={readCapsLock}
                  onKeyUp={readCapsLock}
                  onBlur={() => setCapsLock(false)}
                  {...invalid}
                />
                <FieldCheck />
                <button
                  className="password-toggle"
                  type="button"
                  aria-label={
                    showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
              <span className="login-caps" data-open={capsLock}>
                <span role="status">
                  {capsLock ? "Bloq Mayús activado" : ""}
                </span>
              </span>
            </label>
            <div className="login-error" data-open={Boolean(error)}>
              <div>
                {error && (
                  <p id="login-error" role="alert" className="error">
                    {error}
                  </p>
                )}
              </div>
            </div>
            <button
              ref={submitButton}
              className="primary wide login-submit"
              disabled={locked}
            >
              <span className="submit-label">
                {SUBMIT[phase]}
                {phase === "done" ? (
                  <Check size={17} />
                ) : (
                  <ArrowRight size={17} className="submit-arrow" />
                )}
              </span>
            </button>
            <p role="status" className="login-status">
              {locked ? SUBMIT[phase] : ""}
            </p>
          </form>
          <p className="login-session-note">
            <ShieldCheck size={13} /> Tu sesión permanece protegida.
          </p>
          {demoAccounts.length > 0 && (
            <details className="dev-access">
              <summary>
                <ChevronRight size={15} />
                Accesos de demostración
              </summary>
              {demoAccounts.map((demo) => (
                <button
                  key={demo.email}
                  type="button"
                  className="dev-fill"
                  disabled={locked}
                  onClick={() => fillDemo(demo)}
                >
                  {demo.role}
                  <small>
                    {demo.email} · {demo.password}
                  </small>
                </button>
              ))}
            </details>
          )}
        </div>
        <div className="login-motion">
          <span>Movimiento</span>
          <MotionControl />
        </div>
      </section>
      <footer className="login-bottom">
        <span>Gestión · Plataforma de microservicios</span>
        <span>Diseñado para conectar.</span>
      </footer>
    </main>
  );
}

function FieldCheck() {
  return (
    <svg className="field-check" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" pathLength={1} />
    </svg>
  );
}
