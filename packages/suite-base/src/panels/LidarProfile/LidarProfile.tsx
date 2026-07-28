import { useCallback, useEffect, useRef, useState } from "react";

import { MessageEvent, SettingsTreeAction } from "@lichtblick/suite";
import Stack from "@lichtblick/suite-base/components/Stack";
import {
  decodeHazardPolygon,
  decodeZoneViolations,
} from "@lichtblick/suite-base/panels/BlackboxShared/decode";
import type { PathPoint, ZoneViolation } from "@lichtblick/suite-base/panels/BlackboxShared/decode";
import { updateFrameCache } from "@lichtblick/suite-base/panels/BlackboxShared/frameCache";
import { nearestByTime } from "@lichtblick/suite-base/panels/BlackboxShared/geometry";
import { decodePointCloud } from "@lichtblick/suite-base/panels/BlackboxShared/pointCloud";

import { drawProfile, drawTopDown, LidarProfileInput, LidarProfileScan } from "./draw";
import { settingsActionReducer, useSettingsTree } from "./settings";
import { DEFAULT_CONFIG, LidarProfileConfig, LidarProfileProps } from "./types";

function eventTimeNs(event: MessageEvent): number {
  return event.receiveTime.sec * 1e9 + event.receiveTime.nsec;
}

export function LidarProfile({ context }: LidarProfileProps): React.JSX.Element {
  const topContainerRef = useRef<HTMLDivElement>(null);
  const topCanvasRef = useRef<HTMLCanvasElement>(null);
  const profileContainerRef = useRef<HTMLDivElement>(null);
  const profileCanvasRef = useRef<HTMLCanvasElement>(null);
  const [renderDone, setRenderDone] = useState<() => void>(() => () => {});
  const [config, setConfig] = useState<LidarProfileConfig>(() => ({
    ...DEFAULT_CONFIG,
    ...(context.initialState as Partial<LidarProfileConfig>),
  }));

  const violationsCacheRef = useRef<{ frames?: readonly MessageEvent[]; violations: ZoneViolation[] }>(
    { violations: [] },
  );
  const hazardPolygonRef = useRef<PathPoint[]>([]);
  const scanCacheRef = useRef<{ message?: unknown; scan: LidarProfileScan | undefined }>({
    scan: undefined,
  });
  const lastInputRef = useRef<LidarProfileInput>({
    scan: undefined,
    hazardPolygon: [],
    violation: undefined,
  });

  const redraw = useCallback(() => {
    const topCanvas = topCanvasRef.current;
    const topContainer = topContainerRef.current;
    if (topCanvas && topContainer) {
      const width = Math.max(1, Math.round(topContainer.clientWidth));
      const height = Math.max(1, Math.round(topContainer.clientHeight));
      drawTopDown(topCanvas, width, height, lastInputRef.current);
    }
    const profileCanvas = profileCanvasRef.current;
    const profileContainer = profileContainerRef.current;
    if (profileCanvas && profileContainer) {
      const width = Math.max(1, Math.round(profileContainer.clientWidth));
      const height = Math.max(1, Math.round(profileContainer.clientHeight));
      drawProfile(profileCanvas, width, height, lastInputRef.current);
    }
  }, []);

  useEffect(() => {
    context.saveState(config);
  }, [config, context]);

  useEffect(() => {
    context.subscribe([
      { topic: config.zoneReportTopic, preload: true },
      { topic: config.hazardZoneTopic, preload: false },
      { topic: config.pointCloudTopic, preload: false },
    ]);
    return () => {
      context.unsubscribeAll();
    };
  }, [context, config.zoneReportTopic, config.hazardZoneTopic, config.pointCloudTopic]);

  useEffect(() => {
    context.onRender = (renderState, done) => {
      setRenderDone(() => done);

      if (renderState.didSeek === true) {
        hazardPolygonRef.current = [];
        scanCacheRef.current = { scan: undefined };
      }

      if (renderState.allFrames && renderState.allFrames !== violationsCacheRef.current.frames) {
        const updated = updateFrameCache<ZoneViolation>(
          { frames: violationsCacheRef.current.frames, items: violationsCacheRef.current.violations },
          renderState.allFrames,
          config.zoneReportTopic,
          (event) => decodeZoneViolations(event.message, eventTimeNs(event)),
        );
        violationsCacheRef.current = { frames: updated.frames, violations: updated.items };
      }

      for (const event of renderState.currentFrame ?? []) {
        if (event.topic === config.hazardZoneTopic) {
          hazardPolygonRef.current = decodeHazardPolygon(event.message);
        } else if (event.topic === config.pointCloudTopic) {
          if (scanCacheRef.current.message !== event.message) {
            scanCacheRef.current = {
              message: event.message,
              scan: { tNs: eventTimeNs(event), points: decodePointCloud(event.message) },
            };
          }
        }
      }

      const t0Ns = renderState.currentTime
        ? renderState.currentTime.sec * 1e9 + renderState.currentTime.nsec
        : undefined;

      const violation =
        t0Ns != undefined
          ? nearestByTime(
              violationsCacheRef.current.violations.filter((z) => z.type === 1 && z.violated),
              t0Ns,
            )
          : undefined;

      lastInputRef.current = {
        scan: scanCacheRef.current.scan,
        hazardPolygon: hazardPolygonRef.current,
        violation,
      };
      redraw();
    };

    context.watch("allFrames");
    context.watch("currentFrame");
    context.watch("currentTime");
    context.watch("didSeek");

    return () => {
      context.onRender = undefined;
    };
  }, [context, config, redraw]);

  useEffect(() => {
    const containers = [topContainerRef.current, profileContainerRef.current].filter(
      (el): el is HTMLDivElement => el != undefined,
    );
    if (containers.length === 0) {
      return;
    }
    const observer = new ResizeObserver(() => {
      redraw();
    });
    for (const container of containers) {
      observer.observe(container);
    }
    return () => {
      observer.disconnect();
    };
  }, [redraw]);

  const settingsActionHandler = useCallback((action: SettingsTreeAction) => {
    setConfig((prevConfig) => settingsActionReducer(prevConfig, action));
  }, []);

  const settingsTree = useSettingsTree(config);
  useEffect(() => {
    context.updatePanelSettingsEditor({ actionHandler: settingsActionHandler, nodes: settingsTree });
  }, [context, settingsActionHandler, settingsTree]);

  useEffect(() => {
    renderDone();
  }, [renderDone]);

  return (
    <Stack direction="row" flexWrap="wrap" fullHeight gap={1}>
      <Stack style={{ flex: "1 1 320px", minWidth: 0 }}>
        <div ref={topContainerRef} style={{ flex: "1 1 auto", minHeight: 0, position: "relative" }}>
          <canvas ref={topCanvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
        </div>
        <Stack padding={0.5} style={{ flex: "0 0 auto", fontSize: 12 }}>
          Lidar scan near T0 — top-down (vehicle frame, x forward / y left)
        </Stack>
      </Stack>
      <Stack style={{ flex: "1 1 320px", minWidth: 0 }}>
        <div
          ref={profileContainerRef}
          style={{ flex: "1 1 auto", minHeight: 0, position: "relative" }}
        >
          <canvas
            ref={profileCanvasRef}
            style={{ width: "100%", height: "100%", display: "block" }}
          />
        </div>
        <Stack padding={0.5} style={{ flex: "0 0 auto", fontSize: 12 }}>
          Terrain height profile along the violation bearing (range vs height)
        </Stack>
      </Stack>
    </Stack>
  );
}
