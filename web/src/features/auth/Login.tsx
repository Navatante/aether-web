// src/features/auth/Login.tsx
//
// Página de login para Aether-Web. Solo aparece cuando el usuario no
// tiene sesión (cookie ausente o expirada). Tras login exitoso,
// UserProvider deja al estado en isAuthenticated y App.tsx redirige
// a la ruta protegida solicitada (o /).
//
// Layout split-screen: panel de marca (gradiente teal + escudo de la
// escuadrilla) a la izquierda en pantallas grandes, y tarjeta de
// formulario a la derecha. En móvil solo se ve la tarjeta.

import { useState, type FormEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useUser } from "@/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Loader2, Lock, User } from "lucide-react";

interface LocationState {
    from?: { pathname: string };
}

export default function Login() {
    const { login, error: ctxError, loading: ctxLoading } = useUser();
    const navigate = useNavigate();
    const location = useLocation();
    const dest = (location.state as LocationState | undefined)?.from?.pathname ?? "/";

    const [user, setUser] = useState("");
    const [password, setPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);

    const onSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!user || !password) {
            setLocalError("Usuario y contraseña obligatorios");
            return;
        }
        setSubmitting(true);
        setLocalError(null);
        try {
            await login(user.trim(), password);
            navigate(dest, { replace: true });
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Error de autenticación";
            setLocalError(msg);
        } finally {
            setSubmitting(false);
        }
    };

    const errorMsg = localError ?? ctxError?.message ?? null;
    const busy = submitting || ctxLoading;

    return (
        <div className="grid min-h-screen lg:grid-cols-2">
            {/* ── Panel de marca (solo en pantallas grandes) ── */}
            <aside className="relative hidden overflow-hidden bg-gradient-to-br from-brand-from via-brand-via to-brand-to lg:flex lg:flex-col lg:justify-between lg:p-12">
                {/* Escudo como marca de agua de fondo */}
                <img
                    src="/escudo-14.svg"
                    alt=""
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-24 -bottom-24 w-[34rem] max-w-none select-none opacity-[0.08] mix-blend-luminosity"
                />
                {/* Velo para dar profundidad: brillo arriba-izq., sombra abajo-der. */}
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/30"
                />

                <div className="relative flex items-center gap-3 text-brand-foreground">
                    <div className="leading-tight">
                        <p className="text-lg font-semibold tracking-tight">AETHER</p>
                        <p className="text-xs font-medium uppercase tracking-[0.2em] text-brand-foreground-muted">
                            14ª Escuadrilla
                        </p>
                    </div>
                </div>

                <div className="relative max-w-md text-brand-foreground">
                    <h2 className="text-balance text-4xl font-semibold leading-tight tracking-tight">
                        Operaciones de vuelo, bajo control.
                    </h2>
                    <p className="mt-4 text-pretty text-sm leading-relaxed text-brand-foreground-muted">
                        Vuelos, horas, calificaciones, papeletas, ausencias y comisiones de la
                        Escuadrilla en un único sistema.
                    </p>
                </div>

                <p className="relative text-xs text-brand-foreground-muted">
                    Acceso restringido · Uso interno de la Escuadrilla
                </p>
            </aside>

            {/* ── Panel de formulario ── */}
            <main className="flex items-center justify-center bg-background px-6 py-12">
                <div className="w-full max-w-sm space-y-8 duration-500 animate-in fade-in slide-in-from-bottom-4">
                    {/* Marca para móvil / refuerzo de marca */}
                    <div className="flex flex-col items-center gap-4 text-center">
                        <img src="/aether-logo.svg" alt="Aether" className="h-12 w-auto" />
                        <div className="space-y-1">
                            <h1 className="text-2xl font-semibold tracking-tight">Bienvenido</h1>
                            <p className="text-sm text-muted-foreground">
                                Inicia sesión para continuar
                            </p>
                        </div>
                    </div>

                    <form onSubmit={onSubmit} className="space-y-5" noValidate>
                        <div className="space-y-2">
                            <Label htmlFor="user">Usuario</Label>
                            <div className="relative">
                                <User
                                    aria-hidden="true"
                                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                                />
                                <Input
                                    id="user"
                                    type="text"
                                    autoComplete="username"
                                    autoFocus
                                    className="h-11 pl-9"
                                    aria-invalid={!!localError}
                                    value={user}
                                    onChange={(e) => setUser(e.target.value)}
                                    disabled={busy}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password">Contraseña</Label>
                            <div className="relative">
                                <Lock
                                    aria-hidden="true"
                                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                                />
                                <Input
                                    id="password"
                                    type="password"
                                    autoComplete="current-password"
                                    className="h-11 pl-9"
                                    aria-invalid={!!localError}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={busy}
                                />
                            </div>
                        </div>

                        {errorMsg && (
                            <div
                                role="alert"
                                className="flex items-start gap-2 rounded-md border border-danger/20 bg-danger-muted px-3 py-2.5 text-sm text-danger-muted-foreground"
                            >
                                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                                <span>{errorMsg}</span>
                            </div>
                        )}

                        <Button
                            type="submit"
                            size="lg"
                            disabled={busy}
                            className="h-11 w-full bg-gradient-to-r from-brand-from via-brand-via to-brand-to text-brand-foreground shadow-sm transition-[filter,opacity] hover:opacity-95 hover:brightness-105"
                        >
                            {busy && <Loader2 className="size-4 animate-spin" />}
                            {busy ? "Entrando…" : "Entrar"}
                        </Button>
                    </form>
                </div>
            </main>
        </div>
    );
}
