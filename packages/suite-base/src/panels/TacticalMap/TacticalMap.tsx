import { useCallback, useEffect, useRef, useState } from "react";

import { MessageEvent, SettingsTreeAction } from "@lichtblick/suite";
import Stack from "@lichtblick/suite-base/components/Stack";
import { decodeOdom, decodeHazardPolygon, decodePlannedPath, decodeZoneViolations } from "@lichtblick/suite-base/panels/BlackboxShared/decode";
import type { OdomSample, PathPoint, ZoneViolation } from "@lichtblick/suite-base/panels/BlackboxShared/decode";
import { updateFrameCache } from "@lichtblick/suite-base/panels/BlackboxShared/frameCache";
import { decodePointCloud } from "@lichtblick/suite-base/panels/BlackboxShared/pointCloud";

import { drawTacticalMap, TACTICAL_MAP_LEGEND, TacticalMapInput, TacticalMapScan } from "./draw";
import { settingsActionReducer, useSettingsTree } from "./settings";
import { DEFAULT_CONFIG, TacticalMapConfig, TacticalMapProps } from "./types";

function eventTimeNs(event: MessageEvent): number {
  return event.receiveTime.sec * 1e9 + event.receiveTime.nsec;
}

export function TacticalMap({ context }: TacticalMapProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [renderDone, setRenderDone] = useState<() => void>(() => () => {});
  const [config, setConfig] = useState<TacticalMapConfig>(() => ({
    ...DEFAULT_CONFIG,
    ...(context.initialState as Partial<TacticalMapConfig>),
  }));

  // Decoded data is cached in refs (rather than React state) so per-frame onRender callbacks can
  // update it imperatively without triggering a React re-render for every incoming message --
  // only the canvas draw call cares about it.
  const odomCacheRef = useRef<{ frames?: readonly MessageEvent[]; samples: OdomSample[] }>({
    samples: [],
  });
  const violationsCacheRef = useRef<{ frames?: readonly MessageEvent[]; violations: ZoneViolation[] }>(
    { violations: [] },
  );
  const plannedPathRef = useRef<PathPoint[]>([]);
  const hazardPolygonRef = useRef<PathPoint[]>([]);
  const scanCacheRef = useRef<{ message?: unknown; scan: TacticalMapScan | undefined }>({
    scan: undefined,
  });
  const lastInputRef = useRef<TacticalMapInput>({
    odom: [],
    plannedPath: [],
    hazardPolygon: [],
    zoneViolations: [],
    scan: undefined,
    t0Ns: undefined,
  });

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) {
      return;
    }
    const width = Math.max(1, Math.round(container.clientWidth));
    const height = Math.max(1, Math.round(container.clientHeight));
    drawTacticalMap(canvas, width, height, lastInputRef.current);
  }, []);

  useEffect(() => {
    context.saveState(config);
  }, [config, context]);

  useEffect(() => {
    context.subscribe([
      { topic: config.odomTopic, preload: true },
      { topic: config.zoneReportTopic, preload: true },
      { topic: config.plannedPathTopic, preload: false },
      { topic: config.hazardZoneTopic, preload: false },
      { topic: config.pointCloudTopic, preload: false },
    ]);
    return () => {
      context.unsubscribeAll();
    };
  }, [
    context,
    config.odomTopic,
    config.zoneReportTopic,
    config.plannedPathTopic,
    config.hazardZoneTopic,
    config.pointCloudTopic,
  ]);

  useEffect(() => {
    context.onRender = (renderState, done) => {
      setRenderDone(() => done);

      if (renderState.didSeek === true) {
        plannedPathRef.current = [];
        hazardPolygonRef.current = [];
        scanCacheRef.current = { scan: undefined };
      }

      if (renderState.allFrames && renderState.allFrames !== odomCacheRef.current.frames) {
        const updated = updateFrameCache(
          { frames: odomCacheRef.current.frames, items: odomCacheRef.current.samples },
          renderState.allFrames,
          config.odomTopic,
          (event) => decodeOdom(event.message, eventTimeNs(event)),
        );
        updated.items.sort((a, b) => a.tNs - b.tNs);
        odomCacheRef.current = { frames: updated.frames, samples: updated.items };
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
        if (event.topic === config.plannedPathTopic) {
          plannedPathRef.current = decodePlannedPath(event.message);
        } else if (event.topic === config.hazardZoneTopic) {
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

      lastInputRef.current = {
        odom: odomCacheRef.current.samples,
        plannedPath: plannedPathRef.current,
        hazardPolygon: hazardPolygonRef.current,
        zoneViolations: violationsCacheRef.current.violations,
        scan: scanCacheRef.current.scan,
        t0Ns,
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
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const observer = new ResizeObserver(() => {
      redraw();
    });
    observer.observe(container);
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
    <Stack fullHeight>
      <div ref={containerRef} style={{ flex: "1 1 auto", minHeight: 0, position: "relative" }}>
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
      </div>
      <Stack
        direction="row"
        flexWrap="wrap"
        gap={1.5}
        padding={0.75}
        style={{ flex: "0 0 auto", fontSize: 12 }}
      >
        {TACTICAL_MAP_LEGEND.map((item) => (
          <Stack key={item.label} direction="row" alignItems="center" gap={0.5}>
            <span
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                borderRadius: 2,
                backgroundColor: item.color,
                border: item.border === true ? "1px solid #94a3b8" : undefined,
              }}
            />
            {item.label}
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}
