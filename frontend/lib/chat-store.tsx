"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from "react";

import { endSession, getChatWsUrl, initSession } from "@/lib/api";
import { logoutAndRedirect } from "@/lib/auth";

export interface ChatMessage {
    id: string;
    role: "user" | "ai";
    content: string;
    streaming?: boolean;
    targetContent?: string;
}

interface ChatContextValue {
    messages: ChatMessage[];
    connected: boolean;
    loading: boolean;
    sessionId: string | null;
    ensureSession: () => Promise<void>;
    sendMessage: (content: string) => void;
    startNewChat: () => Promise<void>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [connected, setConnected] = useState(false);
    const [loading, setLoading] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const streamingMsgRef = useRef("");
    const ensurePromiseRef = useRef<Promise<void> | null>(null);

    useEffect(() => {
        function handlePageHide() {
            const activeSessionId = sessionId;
            if (!activeSessionId) {
                return;
            }

            void endSession(activeSessionId).catch(() => {});
        }

        window.addEventListener("pagehide", handlePageHide);
        return () => {
            window.removeEventListener("pagehide", handlePageHide);
        };
    }, [sessionId]);

    const disposeSocket = useCallback(() => {
        const socket = wsRef.current;
        if (!socket) {
            return;
        }

        socket.onopen = null;
        socket.onmessage = null;
        socket.onclose = null;
        socket.onerror = null;
        socket.close();
        wsRef.current = null;
    }, []);

    const connectToSession = useCallback((nextSessionId: string): Promise<void> => {
        if (
            wsRef.current &&
            wsRef.current.readyState === WebSocket.OPEN &&
            sessionId === nextSessionId
        ) {
            setConnected(true);
            return Promise.resolve();
        }

        disposeSocket();

        return new Promise((resolve, reject) => {
            const socket = new WebSocket(getChatWsUrl(nextSessionId));
            wsRef.current = socket;

            socket.onopen = () => {
                setConnected(true);
                resolve();
            };

            socket.onmessage = (event) => {
                const data = event.data;

                if (data === "[EOR]") {
                    setMessages((prev) => {
                        const updated = [...prev];
                        const last = updated[updated.length - 1];

                        if (last && last.role === "ai" && last.streaming) {
                            updated[updated.length - 1] = {
                                ...last,
                                content: last.targetContent ?? last.content,
                                streaming: false,
                            };
                        }

                        return updated;
                    });
                    streamingMsgRef.current = "";
                    return;
                }

                streamingMsgRef.current += data;

                setMessages((prev) => {
                    const updated = [...prev];
                    const last = updated[updated.length - 1];

                    if (last && last.role === "ai" && last.streaming) {
                        updated[updated.length - 1] = {
                            ...last,
                            targetContent: streamingMsgRef.current,
                        };
                    } else {
                        updated.push({
                            id: `ai-${Date.now()}`,
                            role: "ai",
                            content: "",
                            targetContent: streamingMsgRef.current,
                            streaming: true,
                        });
                    }

                    return updated;
                });
            };

            socket.onclose = (event) => {
                if (wsRef.current === socket) {
                    wsRef.current = null;
                }
                setConnected(false);

                if (event.code === 4001) {
                    logoutAndRedirect("expired");
                }
            };

            socket.onerror = () => {
                if (wsRef.current === socket) {
                    wsRef.current = null;
                }
                setConnected(false);
                reject(new Error("Failed to connect chat socket."));
            };
        });
    }, [disposeSocket, sessionId]);

    const ensureSession = useCallback(async () => {
        if (ensurePromiseRef.current) {
            return ensurePromiseRef.current;
        }

        const activeSessionId = sessionId;
        if (activeSessionId && connected) {
            return;
        }

        const promise = (async () => {
            setLoading(true);

            try {
                if (activeSessionId) {
                    await connectToSession(activeSessionId);
                    return;
                }

                const session = await initSession("chat");
                setSessionId(session.session_id);
                await connectToSession(session.session_id);
            } finally {
                setLoading(false);
                ensurePromiseRef.current = null;
            }
        })();

        ensurePromiseRef.current = promise;
        return promise;
    }, [connected, connectToSession, sessionId]);

    const startNewChat = useCallback(async () => {
        setLoading(true);

        try {
            const previousSessionId = sessionId;
            disposeSocket();
            setConnected(false);
            setMessages([]);
            streamingMsgRef.current = "";

            if (previousSessionId) {
                await endSession(previousSessionId).catch(() => {});
            }

            const session = await initSession("chat");
            setSessionId(session.session_id);
            await connectToSession(session.session_id);
        } finally {
            setLoading(false);
        }
    }, [connectToSession, disposeSocket, sessionId]);

    const sendMessage = useCallback((content: string) => {
        const trimmed = content.trim();
        if (!trimmed || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            return;
        }

        setMessages((prev) => [
            ...prev,
            {
                id: `user-${Date.now()}`,
                role: "user",
                content: trimmed,
            },
        ]);

        streamingMsgRef.current = "";
        wsRef.current.send(trimmed);
    }, []);

    return (
        <ChatContext.Provider
            value={{
                messages,
                connected,
                loading,
                sessionId,
                ensureSession,
                sendMessage,
                startNewChat,
            }}
        >
            {children}
        </ChatContext.Provider>
    );
}

export function useChatSession() {
    const context = useContext(ChatContext);
    if (!context) {
        throw new Error("useChatSession must be used within a ChatProvider");
    }
    return context;
}
