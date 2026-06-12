// src/features/auth/Login.tsx
//
// Página de login para Aether-Web. Solo aparece cuando el usuario no
// tiene sesión (cookie ausente o expirada). Tras login exitoso,
// UserProvider deja al estado en isAuthenticated y App.tsx redirige
// a la ruta protegida solicitada (o /).

import { useState, type FormEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useUser } from "@/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Loader2 } from "lucide-react";

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
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <div className="w-full max-w-md space-y-6 border rounded-lg p-8 shadow-lg bg-card">
                <div className="text-center space-y-2">
                    <h1 className="text-2xl font-semibold">Aether</h1>
                    <p className="text-sm text-muted-foreground">Decimocuarta Escuadrilla</p>
                </div>

                <form onSubmit={onSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="user">Usuario</Label>
                        <Input
                            id="user"
                            type="text"
                            autoComplete="username"
                            autoFocus
                            value={user}
                            onChange={(e) => setUser(e.target.value)}
                            disabled={busy}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password">Contraseña</Label>
                        <Input
                            id="password"
                            type="password"
                            autoComplete="current-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={busy}
                        />
                    </div>

                    {errorMsg && (
                        <div className="flex items-start gap-2 text-sm text-destructive">
                            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    <Button type="submit" className="w-full" disabled={busy}>
                        {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Entrar
                    </Button>
                </form>
            </div>
        </div>
    );
}
