"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { getVoiceToken } from "@/lib/api";
import { Track } from "livekit-client";
import {
    LiveKitRoom,
    BarVisualizer,
    RoomAudioRenderer,
    useIsSpeaking,
    useLocalParticipant,
    useVoiceAssistant,
} from "@livekit/components-react";
import "@livekit/components-styles";

function getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return "Failed to connect";
}

export default function VoicePage() {
    const [active, setActive] = useState(false);
    const [status, setStatus] = useState("Requesting voice session...");
    const [voiceToken, setVoiceToken] = useState("");
    const [livekitUrl, setLivekitUrl] = useState("");
    const tokenRequestRef = useRef<Promise<Awaited<ReturnType<typeof getVoiceToken>>> | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function startCall() {
            try {
                if (!tokenRequestRef.current) {
                    tokenRequestRef.current = getVoiceToken();
                }
                const { livekit_token, livekit_url } = await tokenRequestRef.current;
                if (cancelled) return;
                if (!livekit_url) {
                    throw new Error("LiveKit is not configured on the backend.");
                }
                setVoiceToken(livekit_token);
                setLivekitUrl(livekit_url);
                setActive(true);
                setStatus("Joining voice room...");
            } catch (err: unknown) {
                if (cancelled) return;
                tokenRequestRef.current = null;
                setStatus(getErrorMessage(err));
                console.error(err);
            }
        }

        startCall();

        return () => {
            cancelled = true;
        };
    }, []);

    function handleEnd() {
        setActive(false);
        setVoiceToken("");
        setLivekitUrl("");
        setStatus("Call ended");
        window.history.back();
    }

    if (!active) {
        return (
            <div className="voice-page">
                <div className="voice-container">
                    <div className="voice-avatar">
                        <Image
                            src="/ai_model_1.png"
                            alt="Companion"
                            fill
                            priority
                            sizes="180px"
                        />
                    </div>
                    <p className="voice-status">{status}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="voice-page">
            <LiveKitRoom
                serverUrl={livekitUrl}
                token={voiceToken}
                connect={true}
                audio={true}
                video={false}
                onConnected={() => setStatus("")}
                onError={(error) => {
                    console.error(error);
                    setStatus(error.message || "Failed to connect to LiveKit");
                    setActive(false);
                }}
                onMediaDeviceFailure={(error) => {
                    console.error(error);
                    setStatus("Microphone access failed. Check browser permissions.");
                    setActive(false);
                }}
                onDisconnected={handleEnd}
            >
                <VoiceActiveView onDisconnect={handleEnd} />
                <RoomAudioRenderer />
            </LiveKitRoom>
        </div>
    );
}

function VoiceActiveView({ onDisconnect }: { onDisconnect: () => void }) {
    const { agent, state, audioTrack: aiAudioTrack } = useVoiceAssistant();
    const { localParticipant, microphoneTrack } = useLocalParticipant();

    const localTrackRef = microphoneTrack
        ? {
            participant: localParticipant,
            publication: microphoneTrack,
            source: Track.Source.Microphone,
        }
        : undefined;

    return (
        <div className="voice-connected-view">
            <div className="voice-large-avatar-shell">
                <Image
                    src="/ai_model_1.png"
                    alt="Companion"
                    fill
                    priority
                    sizes="100vw"
                    className="voice-large-avatar"
                />
            </div>

            <div className="voice-controls-overlay">
                {agent ? (
                    <VoiceVisualizerWithAgent
                        agent={agent}
                        state={state}
                        aiAudioTrack={aiAudioTrack}
                        localTrackRef={localTrackRef}
                    />
                ) : (
                    <VoiceVisualizer trackRef={localTrackRef} visualizerClass="human-speaking" />
                )}

                <button className="voice-btn-pill" onClick={onDisconnect}>
                    End Call
                </button>
            </div>
        </div>
    );
}

function VoiceVisualizerWithAgent({
    agent,
    state,
    aiAudioTrack,
    localTrackRef,
}: {
    agent: NonNullable<ReturnType<typeof useVoiceAssistant>["agent"]>;
    state: ReturnType<typeof useVoiceAssistant>["state"];
    aiAudioTrack: ReturnType<typeof useVoiceAssistant>["audioTrack"];
    localTrackRef: {
        participant: ReturnType<typeof useLocalParticipant>["localParticipant"];
        publication: NonNullable<ReturnType<typeof useLocalParticipant>["microphoneTrack"]>;
        source: Track.Source;
    } | undefined;
}) {
    const isAgentSpeaking = useIsSpeaking(agent);
    const isAiSpeaking = isAgentSpeaking && Boolean(aiAudioTrack);

    return (
        <VoiceVisualizer
            trackRef={isAiSpeaking ? aiAudioTrack : localTrackRef}
            visualizerClass={isAiSpeaking ? "ai-speaking" : "human-speaking"}
            state={isAiSpeaking ? state : undefined}
        />
    );
}

function VoiceVisualizer({
    trackRef,
    visualizerClass,
    state,
}: {
    trackRef: {
        participant: ReturnType<typeof useLocalParticipant>["localParticipant"];
        publication: NonNullable<ReturnType<typeof useLocalParticipant>["microphoneTrack"]>;
        source: Track.Source;
    } | ReturnType<typeof useVoiceAssistant>["audioTrack"] | undefined;
    visualizerClass: "ai-speaking" | "human-speaking";
    state?: ReturnType<typeof useVoiceAssistant>["state"];
}) {
    return (
        <div className={`voice-visualizer ${visualizerClass}`}>
            {trackRef ? (
                <BarVisualizer
                    state={state}
                    barCount={15}
                    trackRef={trackRef}
                >
                    <span className="voice-visualizer-bar" />
                </BarVisualizer>
            ) : (
                <div className="voice-visualizer-placeholder" aria-hidden="true">
                    {Array.from({ length: 15 }).map((_, index) => (
                        <span key={index} className="voice-visualizer-bar" />
                    ))}
                </div>
            )}
        </div>
    );
}
