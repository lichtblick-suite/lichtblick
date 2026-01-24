// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { useEffect, useRef, useState } from "react";
import { useInterval } from "react-use";

import PanelToolbar from "@lichtblick/suite-base/components/PanelToolbar";
import Stack from "@lichtblick/suite-base/components/Stack";

import { WebRTCCameraConfig } from "./types";

type Props = {
  config: WebRTCCameraConfig;
};

export function WebRTCCamera({ config }: Props): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  const [latencyList, setLatencyList] = useState<number[]>([]);
  const [status, setStatus] = useState<string>("Idle");
  const [latency, setLatency] = useState<number | null>(null);

  // Default to the IP you most commonly use
  const [serverUrl, setServerUrl] = useState<string>("http://172.16.8.77:8080/offer");

  const startWebRTC = async (url: string) => {
    // 1. Cleanup old connection
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    setStatus("Initializing WebRTC...");

    // 2. Create PeerConnection
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    pcRef.current = pc;

    // Handle incoming video stream
    pc.ontrack = (event) => {
      console.log("Received track:", event);
      if (videoRef.current && event.streams[0]) {
        videoRef.current.srcObject = event.streams[0];
      }
    };

    // We are only receiving video
    pc.addTransceiver("video", { direction: "recvonly" });

    // 3. Create & Set Local Offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    setStatus("Gathering Candidates...");

    // =========================
    // SMART ICE GATHERING STRATEGY
    // =========================
    await new Promise<void>((resolve) => {
      let isResolved = false;

      const safeResolve = () => {
        if (!isResolved) {
          isResolved = true;
          // Clean up listeners is handled by the fact we just proceed
          resolve();
        }
      };

      // A. Hard Timeout (2s) - If network is totally weird, just go after 2s.
      const hardTimeout = setTimeout(safeResolve, 2000);

      // B. "Smart" Buffer - Once we see the first IP, wait 500ms then go.
      let bufferTimeout: NodeJS.Timeout | null = null;

      const checkState = () => {
        if (pc.iceGatheringState === "complete") {
          pc.removeEventListener("icegatheringstatechange", checkState);
          if (bufferTimeout) clearTimeout(bufferTimeout);
          clearTimeout(hardTimeout);
          safeResolve();
        }
      };

      pc.addEventListener("icegatheringstatechange", checkState);

      // Listen for individual candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && !bufferTimeout) {
          // First candidate found! Start the 500ms countdown.
          bufferTimeout = setTimeout(() => {
            pc.removeEventListener("icegatheringstatechange", checkState);
            clearTimeout(hardTimeout);
            safeResolve();
          }, 500);
        }
      };
    });
    // =========================

    setStatus("Sending Offer...");

    // 4. Send the Offer to Python
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // pc.localDescription now contains the Candidates we found during the wait
        body: JSON.stringify({
          sdp: pc.localDescription?.sdp,
          type: pc.localDescription?.type,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.statusText}`);
      }

      const answer = await response.json();
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      setStatus("Connected! Waiting for video...");
    } catch (error) {
      console.error("Signaling failed:", error);
      setStatus(`Connection Failed: ${String(error)}`);
    }
  };

  const handleReconnect = () => {
    void startWebRTC(serverUrl).catch((error) => {
      console.error("WebRTC connection failed:", error);
      setStatus(`Error: ${String(error)}`);
    });
  };

  // Auto-connect on mount
  useEffect(() => {
    handleReconnect();

    return () => {
      if (pcRef.current) {
        pcRef.current.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Statistics Loop (Updates every 1s)
  useInterval(() => {
    const pc = pcRef.current;

    if (pc && pc.connectionState === "connected") {
      void pc.getStats().then((stats) => {
        stats.forEach((report) => {
          if (report.type === "inbound-rtp" && report.kind === "video") {
            if (typeof report.framesPerSecond === "number") {
              setStatus(`Live - ${report.framesPerSecond.toFixed(0)} FPS`);
            }
          }

          // Latency Calculation (RTT)
          if (report.type === "candidate-pair" && report.state === "succeeded") {
            const rttSeconds = report.currentRoundTripTime || report.roundTripTime;
            if (typeof rttSeconds === "number") {
              const rttMs = parseFloat((rttSeconds * 1000).toFixed(1));
              setLatency(rttMs);

              setLatencyList((prev) => {
                // Keep the last 600 samples (10 mins) to prevent memory issues
                const updated = [...prev, rttMs];
                if (updated.length > 600) updated.shift();
                return updated;
              });
            }
          }
        });
      });
    }
  }, 1000);

  return (
    <Stack flex="auto">
      <PanelToolbar />

      {/* Control Bar */}
      <Stack padding={1} direction="row" gap={1} alignItems="center">
        <input
          type="text"
          value={serverUrl}
          onChange={(e) => setServerUrl(e.target.value)}
          placeholder="http://<ROBOT-IP>:8080/offer"
          style={{
            flex: 1,
            padding: "8px",
            fontSize: "14px",
            border: "1px solid #ccc",
            borderRadius: "4px",
            color: "black",
          }}
        />
        <button
          onClick={handleReconnect}
          style={{
            padding: "8px 16px",
            fontSize: "14px",
            backgroundColor: "#2E7D32", // Green
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          Connect
        </button>
      </Stack>

      {/* Status & Latency Display */}
      <Stack
        padding={1}
        direction="row"
        justifyContent="space-between"
        style={{ fontSize: "12px", color: "#666" }}
      >
        <span>
          Status: <b>{status}</b>
        </span>
        {latency !== null && (
          <span>
            Latency: <b>{latency} ms</b>
          </span>
        )}
      </Stack>

      {/* Video Player */}
      <Stack
        flex="auto"
        alignItems="center"
        justifyContent="center"
        style={{ backgroundColor: "#000" }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted // Muted is often required for autoplay to work
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </Stack>
    </Stack>
  );
}
