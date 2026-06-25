// HTTP client centralizado contra /api/v1/*.
// - credentials:'include' para enviar la cookie aether_session
// - serializa body JSON
// - lanza HttpError con status y mensaje cuando la respuesta no es OK

export class HttpError extends Error {
    constructor(
        public readonly status: number,
        message: string,
        public readonly body?: unknown,
    ) {
        super(message);
        this.name = "HttpError";
    }
}

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface HttpOptions {
    body?: unknown;
    query?: Record<string, string | number | boolean | undefined | null>;
    headers?: Record<string, string>;
    signal?: AbortSignal;
}

const API_BASE = "/api/v1";

function buildURL(path: string, query?: HttpOptions["query"]): string {
    const url = path.startsWith("/") ? `${API_BASE}${path}` : `${API_BASE}/${path}`;
    if (!query) return url;
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null && v !== "") {
            params.append(k, String(v));
        }
    }
    const qs = params.toString();
    return qs ? `${url}?${qs}` : url;
}

export async function http<T>(method: HttpMethod, path: string, options?: HttpOptions): Promise<T> {
    const url = buildURL(path, options?.query);
    const headers: Record<string, string> = {
        Accept: "application/json",
        ...(options?.headers ?? {}),
    };
    let body: BodyInit | undefined;
    if (options?.body !== undefined) {
        body = JSON.stringify(options.body);
        headers["Content-Type"] = "application/json";
    }

    const res = await fetch(url, {
        method,
        credentials: "include",
        headers,
        body,
        signal: options?.signal,
    });

    // 204 No Content / 205 → caller espera void
    if (res.status === 204 || res.status === 205) {
        return undefined as unknown as T;
    }

    const contentType = res.headers.get("content-type") ?? "";
    const isJson = contentType.includes("application/json");
    const payload = isJson ? await res.json().catch(() => undefined) : await res.text().catch(() => undefined);

    if (!res.ok) {
        const obj = isJson && payload && typeof payload === "object" ? (payload as Record<string, unknown>) : undefined;
        const errorsArr = obj && Array.isArray(obj.errors)
            ? (obj.errors as unknown[]).map(String)
            : undefined;
        const msg =
            (obj && "message" in obj && String(obj.message)) ||
            (errorsArr && errorsArr.length > 0 && errorsArr.join(". ")) ||
            (typeof payload === "string" && payload) ||
            `HTTP ${res.status}`;
        throw new HttpError(res.status, msg, payload);
    }

    return payload as T;
}

// Atajos para el caso 99%.
export const httpGet = <T>(path: string, query?: HttpOptions["query"], signal?: AbortSignal) =>
    http<T>("GET", path, { query, signal });
export const httpPost = <T>(path: string, body?: unknown, signal?: AbortSignal) =>
    http<T>("POST", path, { body, signal });
export const httpPut = <T>(path: string, body?: unknown, signal?: AbortSignal) =>
    http<T>("PUT", path, { body, signal });
export const httpDelete = <T>(path: string, signal?: AbortSignal) =>
    http<T>("DELETE", path, { signal });
