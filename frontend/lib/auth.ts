const TOKEN_KEY = "eros_token";

export type LoginRedirectReason = "expired" | "unauthorized";

export function getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
    localStorage.removeItem(TOKEN_KEY);
}

export function isLoggedIn(): boolean {
    return !!getToken();
}

export function logoutAndRedirect(reason: LoginRedirectReason = "unauthorized"): void {
    if (typeof window === "undefined") {
        return;
    }

    removeToken();
    const nextUrl = `/login?reason=${encodeURIComponent(reason)}`;
    if (window.location.pathname !== "/login" || window.location.search !== `?reason=${reason}`) {
        window.location.replace(nextUrl);
    }
}
