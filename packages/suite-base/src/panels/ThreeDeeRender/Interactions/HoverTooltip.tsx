// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Divider, Paper, Typography } from "@mui/material";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import {
  HOVER_TOOLTIP_GRACE_PERIOD_MS,
  HOVER_TOOLTIP_LEAVE_DELAY_MS,
  HOVER_TOOLTIP_OFFSET_PX,
} from "./constants";
import { useStyles } from "./HoverTooltip.style";
import type { HoverEntityInfo } from "./types";

type TooltipMode = "hidden" | "following" | "grace" | "hover-pinned" | "click-pinned";

type Props = {
  entities: HoverEntityInfo[];
  position: { clientX: number; clientY: number };
  /** Canvas element used to constrain tooltip within the 3D panel bounds. */
  canvas: HTMLCanvasElement | ReactNull;
};

/**
 * Tooltip that follows the mouse cursor and shows metadata for hovered 3D
 * objects. When the user moves the mouse onto the tooltip itself (e.g. to
 * scroll long content), the tooltip becomes interactive and stays visible
 * until the mouse leaves it. Clicking on the tooltip pins it in place until
 * an outside click or the Escape key dismisses it.
 */
export function HoverTooltip({ entities, position, canvas }: Props): React.JSX.Element | ReactNull {
  const { classes } = useStyles();
  const paperRef = useRef<HTMLDivElement>(null);
  const graceTimer = useRef<ReturnType<typeof setTimeout>>();
  const leaveTimer = useRef<ReturnType<typeof setTimeout>>();

  const [mode, setMode] = useState<TooltipMode>("hidden");
  const [visibleEntities, setVisibleEntities] = useState<HoverEntityInfo[]>([]);
  const [frozenPosition, setFrozenPosition] = useState(position);

  // Keep a ref to the current mode so timers always read the latest value.
  const modeRef = useRef(mode);
  modeRef.current = mode;

  // ---------------------------------------------------------------------------
  // React to incoming entity / position changes from the 3D scene
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (entities.length > 0) {
      setVisibleEntities(entities);
      clearTimeout(graceTimer.current);
      if (modeRef.current === "hidden" || modeRef.current === "grace") {
        setMode("following");
      }
    } else {
      // Entities became empty.
      if (modeRef.current === "following") {
        // Freeze position and give the user time to reach the tooltip.
        setFrozenPosition(position);
        setMode("grace");
        clearTimeout(graceTimer.current);
        graceTimer.current = setTimeout(() => {
          if (modeRef.current === "grace") {
            setMode("hidden");
            setVisibleEntities([]);
          }
        }, HOVER_TOOLTIP_GRACE_PERIOD_MS);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entities]);

  // Track position while following so it's available when transitioning.
  useEffect(() => {
    if (mode === "following") {
      setFrozenPosition(position);
    }
  }, [position, mode]);

  // ---------------------------------------------------------------------------
  // Mouse interaction on the tooltip paper
  // ---------------------------------------------------------------------------
  const onMouseEnter = useCallback(() => {
    clearTimeout(graceTimer.current);
    clearTimeout(leaveTimer.current);
    if (modeRef.current === "grace" || modeRef.current === "following") {
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
  useLayoutEffect(() => {
    const el = paperRef.current;
    if (!el) {
      return;
    }
    const displayPos = mode === "following" ? position : frozenPosition;
    const tooltipW = el.offsetWidth;
    const tooltipH = el.offsetHeight;

    // Use canvas bounds when available; fall back to viewport.
    const bounds = canvas
      ? canvas.getBoundingClientRect()
      : { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };

    const spaceRight = bounds.right - displayPos.clientX;
    const spaceLeft = displayPos.clientX - bounds.left;
    const spaceBelow = bounds.bottom - displayPos.clientY;
    const spaceAbove = displayPos.clientY - bounds.top;

    let left: number;
    if (spaceRight >= tooltipW + HOVER_TOOLTIP_OFFSET_PX) {
      left = displayPos.clientX + HOVER_TOOLTIP_OFFSET_PX;
    } else if (spaceLeft >= tooltipW + HOVER_TOOLTIP_OFFSET_PX) {
      left = displayPos.clientX - tooltipW - HOVER_TOOLTIP_OFFSET_PX;
    } else {
      left = Math.max(bounds.left, bounds.right - tooltipW);
    }

    let top: number;
    if (spaceBelow >= tooltipH + HOVER_TOOLTIP_OFFSET_PX) {
      top = displayPos.clientY + HOVER_TOOLTIP_OFFSET_PX;
    } else if (spaceAbove >= tooltipH + HOVER_TOOLTIP_OFFSET_PX) {
      top = displayPos.clientY - tooltipH - HOVER_TOOLTIP_OFFSET_PX;
    } else {
      top = Math.max(bounds.top, bounds.bottom - tooltipH);
    }

    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  });

  // Cleanup timers on unmount.
  useEffect(() => {
    return () => {
      clearTimeout(graceTimer.current);
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
        left: -9999,
        top: -9999,
        pointerEvents: interactive ? "auto" : "none",
        cursor: mode === "click-pinned" ? "default" : undefined,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onTooltipClick}
    >
      {visibleEntities.map((entity, idx) => (
        <div key={`${entity.topic}::${entity.entityId}::${idx}`} className={classes.entitySection}>
          {idx > 0 && <Divider className={classes.divider} />}
          <Typography variant="caption" className={classes.entityId}>
            {entity.entityId}
          </Typography>
          <Typography variant="caption" className={classes.topicLine}>
            {entity.topic}
          </Typography>
          <table className={classes.table}>
            <tbody>
              {entity.metadata.map((kv, rowIdx) => (
                <tr key={`${entity.entityId}::${kv.key}::${rowIdx}`} className={classes.tableRow}>
                  <td className={classes.keyCell}>{kv.key}</td>
                  <td className={classes.valueCell}>{kv.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </Paper>
  );
}
