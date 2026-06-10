// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { VolumeUp, VolumeOff, ErrorOutline } from "@mui/icons-material";
import { Typography } from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useShallowMemo } from "@lichtblick/hooks";
import { SettingsTreeAction, SettingsTreeNodes } from "@lichtblick/suite";

import { useStyles } from "./Audio.style";
import {
  describePlaybackParams,
  ENCODING_LABELS,
  parseAudioMessage,
  AudioPlaybackParams,
} from "./parseAudioMessage";
import { AudioConfig, AudioEncoding, AudioProps, ResolvedAudioEncoding } from "./types";
import { WebMStreamPlayer } from "./webmPlayback";

const DEFAULT_CONFIG: AudioConfig = {
  topic: "",
  encoding: "auto",
  sampleRate: 44100,
  numChannels: 1,
  volume: 1,
};

const IS_AUTO_ENCODING = (enc: AudioEncoding): enc is "auto" => enc === "auto";

const IS_PCM_ENCODING = (enc: ResolvedAudioEncoding): enc is "pcm-float32le" | "pcm-int16le" =>
  enc === "pcm-float32le" || enc === "pcm-int16le";

const IS_WEBM_ENCODING = (enc: ResolvedAudioEncoding): enc is "webm" => enc === "webm";

const MANUAL_ENCODING_OPTIONS: { label: string; value: ResolvedAudioEncoding }[] = [
  { label: ENCODING_LABELS.wav, value: "wav" },
  { label: ENCODING_LABELS.mp3, value: "mp3" },
  { label: ENCODING_LABELS.ogg, value: "ogg" },
  { label: ENCODING_LABELS.aac, value: "aac" },
  { label: ENCODING_LABELS.flac, value: "flac" },
  { label: ENCODING_LABELS.webm, value: "webm" },
  { label: ENCODING_LABELS["pcm-float32le"], value: "pcm-float32le" },
  { label: ENCODING_LABELS["pcm-int16le"], value: "pcm-int16le" },
];

function describeManualEncoding(config: AudioConfig): string {
  const encoding = config.encoding;
  if (encoding === "auto") {
    return "Auto-detect";
  }
  if (IS_PCM_ENCODING(encoding)) {
    return `${ENCODING_LABELS[encoding]} @ ${config.sampleRate.toLocaleString()} Hz, ${config.numChannels} ch`;
  }
  return ENCODING_LABELS[encoding];
}

/**
 * Decode raw PCM bytes into an AudioBuffer.
 *
 * @param ctx      - The AudioContext used to create the buffer.
 * @param data     - Raw PCM bytes (little-endian float32 or int16).
 * @param encoding - "pcm-float32le" or "pcm-int16le"
 * @param sampleRate - Sample rate in Hz.
 * @param numChannels - Number of interleaved audio channels.
 */
function decodePCM(
  ctx: AudioContext,
  data: Uint8Array,
  encoding: "pcm-float32le" | "pcm-int16le",
  sampleRate: number,
  numChannels: number,
): AudioBuffer {
  const bytesPerSample = encoding === "pcm-float32le" ? 4 : 2;
  const totalSamples = Math.floor(data.byteLength / bytesPerSample);
  const samplesPerChannel = Math.floor(totalSamples / numChannels);

  const buffer = ctx.createBuffer(numChannels, samplesPerChannel, sampleRate);

  const dataView = new DataView(data.buffer, data.byteOffset, data.byteLength);

  for (let ch = 0; ch < numChannels; ch++) {
    const channelData = buffer.getChannelData(ch);
    for (let i = 0; i < samplesPerChannel; i++) {
      const byteOffset = (i * numChannels + ch) * bytesPerSample;
      if (encoding === "pcm-float32le") {
        channelData[i] = dataView.getFloat32(byteOffset, /* littleEndian */ true);
      } else {
        channelData[i] = dataView.getInt16(byteOffset, /* littleEndian */ true) / 32768;
      }
    }
  }

  return buffer;
}

function buildSettingsTree(
  config: AudioConfig,
  topics: readonly string[],
): SettingsTreeNodes {
  const isManualPCM = !IS_AUTO_ENCODING(config.encoding) && IS_PCM_ENCODING(config.encoding);

  return {
    general: {
      fields: {
        topic: {
          label: "Topic",
          input: "autocomplete",
          value: config.topic,
          items: [...topics],
          placeholder: "Select a topic…",
        },
        encoding: {
          label: "Encoding",
          input: "select",
          value: config.encoding,
          options: [
            { label: "Auto-detect", value: "auto" },
            ...MANUAL_ENCODING_OPTIONS,
          ],
        },
        volume: {
          label: "Volume",
          input: "slider",
          value: config.volume,
          min: 0,
          max: 1,
          step: 0.05,
        },
        ...(isManualPCM && {
          sampleRate: {
            label: "Sample Rate (Hz)",
            input: "number",
            value: config.sampleRate,
            min: 1,
            step: 100,
          },
          numChannels: {
            label: "Channels",
            input: "number",
            value: config.numChannels,
            min: 1,
            max: 32,
            step: 1,
          },
        }),
      },
    },
  };
}

function settingsActionReducer(prevConfig: AudioConfig, action: SettingsTreeAction): AudioConfig {
  if (action.action !== "update") {
    return prevConfig;
  }
  const key = action.payload.path[1];
  if (key == undefined) {
    return prevConfig;
  }
  return { ...prevConfig, [key]: action.payload.value };
}

export function AudioPanel({ context }: AudioProps): React.JSX.Element {
  const { classes, cx } = useStyles();

  const [renderDone, setRenderDone] = useState<() => void>(() => () => {});
  const [config, setConfig] = useState<AudioConfig>(() => ({
    ...DEFAULT_CONFIG,
    ...(context.initialState as Partial<AudioConfig>),
  }));
  const [availableTopics, setAvailableTopics] = useState<string[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [detectedPlayback, setDetectedPlayback] = useState<AudioPlaybackParams | undefined>();

  const audioCtxRef = useRef<AudioContext | undefined>();
  const gainNodeRef = useRef<GainNode | undefined>();
  const webmPlayerRef = useRef<WebMStreamPlayer | undefined>();
  // Tracks the scheduled end time (in AudioContext seconds) of the last queued chunk.
  const nextStartTimeRef = useRef<number>(0);
  const playbackChainRef = useRef<Promise<void>>(Promise.resolve());

  // Lazily create the AudioContext and GainNode on first use.
  const getOrCreateCtx = useCallback((): AudioContext => {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      const ctx = new AudioContext();
      const gain = ctx.createGain();
      gain.gain.value = config.volume;
      gain.connect(ctx.destination);
      audioCtxRef.current = ctx;
      gainNodeRef.current = gain;
      nextStartTimeRef.current = 0;
    }
    return audioCtxRef.current;
  }, [config.volume]);

  // Update gain when volume changes.
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = config.volume;
    }
  }, [config.volume]);

  // Tear down AudioContext when the panel unmounts.
  useEffect(() => {
    return () => {
      webmPlayerRef.current?.reset();
      webmPlayerRef.current = undefined;
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = undefined;
      gainNodeRef.current = undefined;
    };
  }, []);

  // Reset WebM streaming when switching to a non-WebM manual encoding.
  useEffect(() => {
    if (!IS_AUTO_ENCODING(config.encoding) && !IS_WEBM_ENCODING(config.encoding)) {
      webmPlayerRef.current?.reset();
      webmPlayerRef.current = undefined;
    }
  }, [config.encoding]);

  // Clear playback state when topic or encoding mode changes.
  useEffect(() => {
    setDetectedPlayback(undefined);
    setIsPlaying(false);
    setError(undefined);
    playbackChainRef.current = Promise.resolve();
  }, [config.encoding, config.topic]);

  const playAudioData = useCallback(
    async ({ bytes, encoding, sampleRate, numChannels }: AudioPlaybackParams): Promise<void> => {
      const ctx = getOrCreateCtx();

      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      if (IS_WEBM_ENCODING(encoding)) {
        const gainNode = gainNodeRef.current;
        if (gainNode == undefined) {
          throw new Error("Audio output is not initialized");
        }

        if (webmPlayerRef.current == undefined) {
          webmPlayerRef.current = new WebMStreamPlayer(ctx, gainNode);
        }

        webmPlayerRef.current.append(bytes);
        setIsPlaying(true);
        return;
      }

      webmPlayerRef.current?.reset();
      webmPlayerRef.current = undefined;

      let audioBuffer: AudioBuffer;

      if (IS_PCM_ENCODING(encoding)) {
        audioBuffer = decodePCM(ctx, bytes, encoding, sampleRate, numChannels);
      } else {
        // decodeAudioData takes ownership of the ArrayBuffer so we must copy.
        const copy = new ArrayBuffer(bytes.byteLength);
        new Uint8Array(copy).set(bytes);
        audioBuffer = await ctx.decodeAudioData(copy);
      }

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(gainNodeRef.current ?? ctx.destination);

      const startTime = Math.max(nextStartTimeRef.current, ctx.currentTime);
      source.start(startTime);
      nextStartTimeRef.current = startTime + audioBuffer.duration;

      setIsPlaying(true);
      source.onended = () => {
        // Only mark as stopped if nothing else is queued.
        if (nextStartTimeRef.current <= ctx.currentTime + 0.05) {
          setIsPlaying(false);
        }
      };
    },
    [getOrCreateCtx],
  );

  useEffect(() => {
    context.onRender = (renderState, done) => {
      setRenderDone(() => done);

      if (renderState.topics) {
        setAvailableTopics(renderState.topics.map((t) => t.name));
      }

      if (renderState.didSeek === true) {
        // Reset audio queue on seek; close and recreate the context on next message.
        webmPlayerRef.current?.reset();
        webmPlayerRef.current = undefined;
        audioCtxRef.current?.close().catch(() => {});
        audioCtxRef.current = undefined;
        gainNodeRef.current = undefined;
        nextStartTimeRef.current = 0;
        playbackChainRef.current = Promise.resolve();
        setIsPlaying(false);
        setDetectedPlayback(undefined);
      }

      if (renderState.currentFrame && renderState.currentFrame.length > 0) {
        for (const msg of renderState.currentFrame) {
          const result = parseAudioMessage(msg.message as Record<string, unknown>, config);
          switch (result.status) {
            case "empty":
              break;
            case "error":
              setError(result.message);
              setIsPlaying(false);
              break;
            case "ok":
              setDetectedPlayback(result.params);
              setError(undefined);
              playbackChainRef.current = playbackChainRef.current
                .then(() => playAudioData(result.params))
                .catch((err: unknown) => {
                  setError(String(err));
                  setIsPlaying(false);
                });
              break;
          }
        }
      }
    };

    context.watch("currentFrame");
    context.watch("didSeek");
    context.watch("topics");

    return () => {
      context.onRender = undefined;
    };
  }, [config, context, playAudioData]);

  useEffect(() => {
    context.saveState(config);
    context.setDefaultPanelTitle(config.topic !== "" ? config.topic : undefined);
  }, [config, context]);

  useEffect(() => {
    if (config.topic !== "") {
      context.subscribe([{ topic: config.topic, preload: false }]);
    }
    return () => {
      context.unsubscribeAll();
    };
  }, [context, config.topic]);

  const settingsActionHandler = useCallback(
    (action: SettingsTreeAction) => {
      setConfig((prev) => settingsActionReducer(prev, action));
    },
    [],
  );

  const topicsMemo = useShallowMemo(availableTopics);
  const settingsTree = useMemo(
    () => buildSettingsTree(config, topicsMemo),
    [config, topicsMemo],
  );

  useEffect(() => {
    context.updatePanelSettingsEditor({
      actionHandler: settingsActionHandler,
      nodes: settingsTree,
    });
  }, [context, settingsActionHandler, settingsTree]);

  useEffect(() => {
    renderDone();
  }, [renderDone]);

  const noTopic = config.topic === "";

  const encodingText = useMemo(() => {
    if (IS_AUTO_ENCODING(config.encoding)) {
      return detectedPlayback != undefined
        ? `Auto-detect: ${describePlaybackParams(detectedPlayback)}`
        : "Auto-detect — waiting for format…";
    }
    return describeManualEncoding(config);
  }, [config, detectedPlayback]);

  return (
    <div className={classes.root}>
      {error != undefined ? (
        <>
          <ErrorOutline className={classes.icon} color="error" />
          <Typography className={classes.errorText}>{error}</Typography>
        </>
      ) : noTopic ? (
        <>
          <VolumeOff className={classes.icon} />
          <Typography className={classes.statusText}>No topic selected</Typography>
          <Typography className={classes.statusText}>
            Open the panel settings to choose an audio topic.
          </Typography>
        </>
      ) : (
        <>
          <VolumeUp
            className={cx(classes.icon, { [classes.iconPlaying]: isPlaying })}
          />
          <Typography className={classes.topicText}>{config.topic}</Typography>
          <Typography className={classes.encodingText}>{encodingText}</Typography>
          <Typography className={classes.statusText}>
            {isPlaying ? "Playing" : "Waiting for data…"}
          </Typography>
        </>
      )}
    </div>
  );
}
