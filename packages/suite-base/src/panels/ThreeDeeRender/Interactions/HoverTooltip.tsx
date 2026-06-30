// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Divider, Paper, Typography } from "@mui/material";
import { useCallback, useEffect, useRef, useState } from "react";

import { useStyles } from "./HoverTooltip.style";
import {
  HOVER_TOOLTIP_DWELL_MS,
  HOVER_TOOLTIP_GRACE_PERIOD_MS,
  HOVER_TOOLTIP_LEAVE_DELAY_MS,
  HOVER_TOOLTIP_MAX_H,
  HOVER_TOOLTIP_MAX_W,
  HOVER_TOOLTIP_OFFSET_PX,
} from "./constants";
import { clampTooltipAxis } from "./helpers";
import type { HoverEntityInfo, HoverTooltipProperties, TooltipMode } from "./types";

/**
 * Tooltip that follows the mouse cursor and shows metadata for hovered 3D
 * objects. When the user moves the mouse onto the tooltip itself (e.g. to
 * scroll long content), the tooltip becomes interactive and stays visible
 * until the mouse leaves it. Clicking on the tooltip pins it in place until
 * an outside click or the Escape key dismisses it.
 */
export function HoverTooltip({
  entities,
  position,
  canvas,
}: HoverTooltipProperties): React.JSX.Element | ReactNull {
  const { classes } = useStyles();
  const paperRef = useRef<HTMLDivElement>(ReactNull);
  const graceTimer = useRef<ReturnType<typeof setTimeout>>();
  const dwellTimer = useRef<ReturnType<typeof setTimeout>>();
  const leaveTimer = useRef<ReturnType<typeof setTimeout>>();
  /** Entities queued during a grace period; applied when the timer expires. */
  const pendingEntities = useRef<HoverEntityInfo[]>([]);
  /**
   * Stable key for the currently displayed set of entities. Used to detect
   * when the hovered object actually changes vs. the same pick being re-sent.
   */
  const lastEntityKey = useRef<string>("");

  const [mode, setMode] = useState<TooltipMode>("hidden");
  const [visibleEntities, setVisibleEntities] = useState<HoverEntityInfo[]>([]);
  const [frozenPosition, setFrozenPosition] = useState(position);

  // Keep a ref to the current mode so timers always read the latest value.
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const startDwellTimer = useCallback(() => {
    clearTimeout(dwellTimer.current);
    dwellTimer.current = setTimeout(() => {
      if (modeRef.current === "following") {
        setMode("settled");
      }
    }, HOVER_TOOLTIP_DWELL_MS);
  }, []);

  const startGraceHideTimer = useCallback(() => {
    graceTimer.current = setTimeout(() => {
      if (modeRef.current === "grace") {
        setMode("hidden");
        setVisibleEntities([]);
      }
    }, HOVER_TOOLTIP_GRACE_PERIOD_MS);
  }, []);

  const startGraceTransitionTimer = useCallback(() => {
    graceTimer.current = setTimeout(() => {
      if (modeRef.current !== "grace") {
        return;
      }
      const pending = pendingEntities.current;
      if (pending.length > 0) {
        setVisibleEntities(pending);
        setMode("following");
        startDwellTimer();
      } else {
        setMode("hidden");
        setVisibleEntities([]);
      }
    }, HOVER_TOOLTIP_GRACE_PERIOD_MS);
  }, [startDwellTimer]);

  const handleEntitiesPresent = useCallback(
    (
      currentMode: TooltipMode,
      currentEntities: HoverEntityInfo[],
      { keyChanged }: { keyChanged: boolean },
    ) => {
      if (currentMode === "hidden" || currentMode === "following") {
        // Fast mode: update content immediately as the user browses.
        setVisibleEntities(currentEntities);
        clearTimeout(graceTimer.current);
        if (currentMode === "hidden") {
          setMode("following");
        }
        if (keyChanged || currentMode === "hidden") {
          startDwellTimer();
        }
        return;
      }
      if (currentMode === "settled") {
        if (!keyChanged) {
          return; // Still on the same object – stay settled.
        }
        // The user moved to a different object while settled.
        setFrozenPosition(position);
        pendingEntities.current = currentEntities;
        clearTimeout(dwellTimer.current);
        clearTimeout(graceTimer.current);
        setMode("grace");
        startGraceTransitionTimer();
        return;
      }
      // Queue the latest entities to be shown when the grace period ends.
      pendingEntities.current = currentEntities;
    },
    [position, startDwellTimer, startGraceTransitionTimer],
  );

  const handleEntitiesCleared = useCallback(
    (currentMode: TooltipMode) => {
      if (currentMode === "following" || currentMode === "settled") {
        // Entities cleared.
        clearTimeout(dwellTimer.current);
        clearTimeout(graceTimer.current);
        setFrozenPosition(position);
        pendingEntities.current = [];
        setMode("grace");
        startGraceHideTimer();
        return;
      }
      if (currentMode === "grace") {
        // Already in grace – just clear pending so the timer hides the tooltip.
        pendingEntities.current = [];
      }
    },
    [position, startGraceHideTimer],
  );

  // ---------------------------------------------------------------------------
  // React to incoming entity / position changes from the 3D scene
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const currentMode = modeRef.current;

    // Always keep the entity key up to date, even while pinned. This avoids
    // stale comparisons after the tooltip is dismissed.
    const newKey = entities.map((entity) => `${entity.topic ?? ""}::${entity.entityId}`).join("|");
    const keyChanged = newKey !== lastEntityKey.current;
    lastEntityKey.current = newKey;

    // These modes are fully frozen – the user is actively interacting with the
    // tooltip, so we must not disturb its content or position.
    if (currentMode === "click-pinned" || currentMode === "hover-pinned") {
      return;
    }

    if (entities.length > 0) {
      handleEntitiesPresent(currentMode, entities, { keyChanged });
    } else {
      handleEntitiesCleared(currentMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entities]);

  // Track position while following/settled so the frozen position is current
  // when we transition into grace.
  useEffect(() => {
    if (mode === "following" || mode === "settled") {
      setFrozenPosition(position);
    }
  }, [position, mode]);

  // ---------------------------------------------------------------------------
  // Mouse interaction on the tooltip paper
  // ---------------------------------------------------------------------------
  const onMouseEnter = useCallback(() => {
    clearTimeout(graceTimer.current);
    clearTimeout(dwellTimer.current);
    clearTimeout(leaveTimer.current);
    const currentMode = modeRef.current;
    if (currentMode === "grace" || currentMode === "following" || currentMode === "settled") {
      setMode("hover-pinned");
    }
  }, []);

  const onMouseLeave = useCallback(() => {
    if (modeRef.current === "click-pinned") {
      return; // click-pinned stays until explicit dismiss
    }
    leaveTimer.current = setTimeout(() => {
      if (modeRef.current === "hover-pinned") {
        setMode("hidden");
        setVisibleEntities([]);
      }
    }, HOVER_TOOLTIP_LEAVE_DELAY_MS);
  }, []);

  const onTooltipClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (modeRef.current !== "click-pinned") {
      setMode("click-pinned");
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Click outside to dismiss click-pinned tooltip
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (mode !== "click-pinned") {
      return undefined;
    }
    const handler = (e: MouseEvent) => {
      if (paperRef.current && !paperRef.current.contains(e.target as Node)) {
        setMode("hidden");
        setVisibleEntities([]);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
    };
  }, [mode]);

  // ---------------------------------------------------------------------------
  // Escape key dismisses the tooltip in any active mode
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (mode === "hidden") {
      return undefined;
    }
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        clearTimeout(graceTimer.current);
        clearTimeout(leaveTimer.current);
        setMode("hidden");
        setVisibleEntities([]);
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
    };
  }, [mode]);

  // ---------------------------------------------------------------------------
  // Smart positioning: keep tooltip inside the 3D panel (or viewport)
  // ---------------------------------------------------------------------------
  const displayPos = mode === "following" || mode === "settled" ? position : frozenPosition;
  const bounds =
    canvas == undefined
      ? { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight }
      : canvas.getBoundingClientRect();

  // Use measured element size when available so the tooltip stays close to the
  // cursor. Fall back to the CSS max dimensions only on the very first render.
  const tooltipElement = paperRef.current;
  const tooltipW = tooltipElement == undefined ? HOVER_TOOLTIP_MAX_W : tooltipElement.offsetWidth;
  const tooltipH = tooltipElement == undefined ? HOVER_TOOLTIP_MAX_H : tooltipElement.offsetHeight;

  const tooltipLeft = clampTooltipAxis(
    displayPos.clientX,
    tooltipW,
    bounds.left,
    bounds.right,
    HOVER_TOOLTIP_OFFSET_PX,
  );
  const tooltipTop = clampTooltipAxis(
    displayPos.clientY,
    tooltipH,
    bounds.top,
    bounds.bottom,
    HOVER_TOOLTIP_OFFSET_PX,
  );

  // Cleanup timers on unmount.
  useEffect(() => {
    return () => {
      clearTimeout(graceTimer.current);
      clearTimeout(dwellTimer.current);
      clearTimeout(leaveTimer.current);
    };
  }, []);

  if (mode === "hidden" || visibleEntities.length === 0) {
    return ReactNull;
  }

  const interactive = mode !== "following";

  return (
    <Paper
      ref={paperRef}
      className={classes.root}
      elevation={8}
      style={{
        left: tooltipLeft,
        top: tooltipTop,
        pointerEvents: interactive ? "auto" : "none",
        cursor: mode === "click-pinned" ? "default" : undefined,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onTooltipClick}
    >
      {visibleEntities.map((entity, entityIndex) => (
        <div
          key={`${entity.topic}::${entity.entityId}::${entityIndex}`}
          className={classes.entitySection}
        >
          {entityIndex > 0 && <Divider className={classes.divider} />}
          <Typography variant="caption" className={classes.entityId}>
            {entity.entityId}
          </Typography>
          {entity.topic != undefined && (
            <Typography variant="caption" className={classes.topicLine}>
              {entity.topic}
            </Typography>
          )}
          <table className={classes.table}>
            <tbody>
              {entity.metadata.map((metadataEntry, rowIndex) => (
                <tr
                  key={`${entity.entityId}::${metadataEntry.key}::${rowIndex}`}
                  className={classes.tableRow}
                >
                  <td className={classes.keyCell}>{metadataEntry.key}</td>
                  <td className={classes.valueCell}>{metadataEntry.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {interactive && mode !== "click-pinned" && (
        <Typography variant="caption" className={classes.pinHint}>
          Click to pin
        </Typography>
      )}
    </Paper>
  );
}
