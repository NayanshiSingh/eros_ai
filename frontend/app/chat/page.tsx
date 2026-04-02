"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useChatSession } from "@/lib/chat-store";

export default function ChatPage() {
    const router = useRouter();
    const {
        messages,
        connected,
        loading,
        ensureSession,
        sendMessage,
        startNewChat,
    } = useChatSession();
    const [input, setInput] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        void ensureSession();
    }, [ensureSession]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    function handleSend() {
        if (!input.trim() || !connected) {
            return;
        }

        sendMessage(input);
        setInput("");
    }

    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }

    if (loading && messages.length === 0) {
        return (
            <div className="chat-page">
                <div className="chat-avatar-panel">
                    <Image
                        src="/ai_model_1.png"
                        alt="Companion"
                        fill
                        priority
                        sizes="(max-width: 768px) 0px, 40vw"
                        className="chat-avatar-image"
                    />
                </div>
                <div className="chat-panel">
                    <div className="empty-state" style={{ height: "100%" }}>
                        <div className="loading-spinner" />
                        <span>Connecting...</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="chat-page">
            <div className="chat-avatar-panel">
                <Image
                    src="/ai_model_1.png"
                    alt="Companion"
                    fill
                    priority
                    sizes="(max-width: 768px) 0px, 40vw"
                    className="chat-avatar-image"
                />
            </div>

            <div className="chat-panel">
                <div className="chat-messages">
                    <div className="chat-thread">
                        <div className="chat-thread-toolbar">
                            <div className={`chat-connection-pill ${connected ? "connected" : "disconnected"}`}>
                                {connected ? "Live session" : "Reconnecting"}
                            </div>
                            <button
                                className="chat-reset-btn"
                                type="button"
                                onClick={() => void startNewChat()}
                                disabled={loading}
                            >
                                New chat
                            </button>
                        </div>

                        {messages.length === 0 && (
                            <div className="empty-state">
                                <span style={{ fontSize: "1.5rem" }}>💬</span>
                                <span>Say something to start the conversation</span>
                            </div>
                        )}

                        {messages.map((msg) => (
                            <div key={msg.id} className={`chat-message-row ${msg.role}`}>
                                <div className={`chat-message ${msg.role}${msg.streaming ? " streaming" : ""}`}>
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                </div>

                <div className="chat-input-area">
                    <div className="chat-input-shell">
                        <button
                            className="chat-voice-btn"
                            onClick={() => router.push("/voice")}
                            title="Voice Call"
                        >
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                            </svg>
                        </button>
                        <div className="chat-input-container">
                            <input
                                className="chat-input"
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={connected ? "Type a message..." : "Disconnected"}
                                disabled={!connected}
                            />
                            <button
                                className="chat-send-btn"
                                onClick={handleSend}
                                disabled={!input.trim() || !connected}
                            >
                                +
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
