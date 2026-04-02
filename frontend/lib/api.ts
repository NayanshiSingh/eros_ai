import { getToken, logoutAndRedirect } from "./auth";

interface FetchOptions extends RequestInit {
    skipAuth?: boolean;
}

const DEFAULT_API_PORT = "8000";
const DEFAULT_SERVER_API_BASE = `http://localhost:${DEFAULT_API_PORT}`;

function trimTrailingSlash(value: string): string {
    return value.replace(/\/+$/, "");
}

function getApiBase(): string {
    if (process.env.NEXT_PUBLIC_API_URL) {
        return trimTrailingSlash(process.env.NEXT_PUBLIC_API_URL);
    }

    if (typeof window === "undefined") {
        return DEFAULT_SERVER_API_BASE;
    }

    return `${window.location.protocol}//${window.location.hostname}:${DEFAULT_API_PORT}`;
}

async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
    const { skipAuth, ...fetchOptions } = options;
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(fetchOptions.headers as Record<string, string>),
    };

    if (!skipAuth) {
        const token = getToken();
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }
    }

    const apiBase = getApiBase();

    const res = await fetch(`${apiBase}${path}`, {
        ...fetchOptions,
        headers,
    });

    if (res.status === 401 && !skipAuth) {
        logoutAndRedirect("expired");
        throw new Error("Session expired. Please sign in again.");
    }

    if (!res.ok) {
        const error = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(error.detail || `API error: ${res.status}`);
    }

    return res.json();
}

// ─── Auth ────────────────────────────────────────────────────

export interface LoginResponse {
    user_id: string;
    token: string;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
    return apiFetch("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
        skipAuth: true,
    });
}

export async function register(email: string, password: string, name: string): Promise<LoginResponse> {
    return apiFetch("/api/v1/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, name }),
        skipAuth: true,
    });
}

export interface UserProfile {
    id: string;
    email: string;
    name: string;
    language: string;
}

export async function getMe(): Promise<UserProfile> {
    return apiFetch("/api/v1/auth/me");
}

// ─── Session ─────────────────────────────────────────────────

export interface SessionInit {
    session_id: string;
}

export async function initSession(mode: string = "chat"): Promise<SessionInit> {
    return apiFetch("/api/v1/session/init", {
        method: "POST",
        body: JSON.stringify({ mode }),
    });
}

export async function endSession(sessionId: string): Promise<void> {
    return apiFetch(`/api/v1/session/${sessionId}/end`, { method: "POST" });
}

// ─── Memory ──────────────────────────────────────────────────

export interface MemoryItem {
    id: string;
    user_id: string;
    type: string;
    field: string | null;
    content: string;
    tag: string | null;
    subtype: string | null;
    entities: string[];
    emotional_weight: number;
    feedback: "up" | "down" | null;
    created_at: string;
}

export interface MemoryUpdatePayload {
    content?: string;
    tag?: string | null;
    subtype?: string | null;
    entities?: string[];
    emotional_weight?: number;
    feedback?: "up" | "down";
}

export async function getColdMemories(): Promise<MemoryItem[]> {
    return apiFetch("/api/v1/memory/cold");
}

export async function updateMemory(memoryId: string, updates: MemoryUpdatePayload): Promise<MemoryItem> {
    return apiFetch(`/api/v1/memory/${memoryId}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
    });
}

// ─── Voice ───────────────────────────────────────────────────

export interface VoiceToken {
    session_id: string;
    livekit_token: string;
    room_name: string;
    livekit_url: string;
}

export async function getVoiceToken(): Promise<VoiceToken> {
    return apiFetch("/api/v1/voice/token", { method: "POST" });
}

// ─── Dashboard ───────────────────────────────────────────────

export interface PersonalityProfile {
    user_id: string;
    jungian_type: string | null;
    type_confidence: number;
    archetypes: Array<{ name?: string; weight?: number }>;
    trait_weights: Record<string, number>;
    attachment_style: string | null;
    cognitive_style: string | null;
    core_values: string[];
    version: number;
    last_updated: string | null;
    history: PersonalityHistorySnapshot[];
}

export interface PersonalityHistorySnapshot {
    version: number;
    timestamp: string | null;
    weights: Record<string, number>;
    jungian_type: string | null;
    archetypes: Array<{ name?: string; weight?: number }>;
}

export async function getPersonality(): Promise<PersonalityProfile> {
    return apiFetch("/api/v1/dashboard/personality");
}

export interface DayActivity {
    date: string;
    session_count: number;
    turn_count: number;
    chat_turns: number;
    voice_turns: number;
}

export interface ActivityData {
    user_id: string;
    days: DayActivity[];
    total_sessions: number;
    total_turns: number;
}

export async function getActivity(days: number = 30): Promise<ActivityData> {
    return apiFetch(`/api/v1/dashboard/activity?days=${days}`);
}

export interface DiaryEntry {
    id: string;
    date: string;
    content: string;
    page_number: number;
    created_at: string;
}

export interface LockedDiaryPreview {
    id: string;
    date: string;
    page_number: number;
    preview: string;
}

export interface DiaryList {
    entries: DiaryEntry[];
    total: number;
    total_entries: number;
    locked_entries: number;
    locked_previews: LockedDiaryPreview[];
    pages_owned: number;
    page: number;
    page_size: number;
}

export async function getDiary(page: number = 1, pageSize: number = 4): Promise<DiaryList> {
    return apiFetch(`/api/v1/dashboard/diary?page=${page}&page_size=${pageSize}`);
}

export interface TraitItem {
    id: string;
    name: string;
    category: string;
    prompt_modifier: string;
    coin_cost: number;
    locked: boolean;
    is_active: boolean;
}

export interface TraitLibrary {
    traits: TraitItem[];
    active_trait_ids: string[];
}

export async function getTraits(): Promise<TraitLibrary> {
    return apiFetch("/api/v1/dashboard/traits");
}

// ─── Persona ─────────────────────────────────────────────────

export async function updateActiveTraits(traitIds: string[]): Promise<void> {
    return apiFetch("/api/v1/persona/active", {
        method: "PATCH",
        body: JSON.stringify({ active_trait_ids: traitIds }),
    });
}

// ─── Coins ───────────────────────────────────────────────────

export interface CoinBalance {
    total_coins: number;
    daily_earned_today: number;
    daily_cap: number;
    diary_pages_owned: number;
}

export async function getBalance(): Promise<CoinBalance> {
    return apiFetch("/api/v1/coins/balance");
}

export async function buyDiaryPage(): Promise<{ diary_pages_owned: number; remaining_coins: number }> {
    return apiFetch("/api/v1/coins/buy-diary-page", { method: "POST" });
}

// ─── WebSocket ───────────────────────────────────────────────

export function getChatWsUrl(sessionId: string): string {
    const token = getToken();
    const wsUrl = new URL(getApiBase());
    wsUrl.protocol = wsUrl.protocol === "https:" ? "wss:" : "ws:";
    wsUrl.pathname = `/ws/session/${sessionId}/chat`;
    wsUrl.search = `?token=${token}`;
    return wsUrl.toString();
}
