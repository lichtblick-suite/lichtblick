// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { KeyboardArrowDown, KeyboardArrowUp } from "@mui/icons-material";
import {
  Chip,
  ChipProps,
  Collapse,
  IconButton,
  LinearProgress,
  Paper,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import Stack from "@lichtblick/suite-base/components/Stack";
import type { ToolRun, ToolRunStatus } from "@lichtblick/suite-base/services/agent/types";

import { useStyles } from "./AgentChatSidebar.style";

const STATUS_LABEL_KEYS = {
  queued: "toolStatus.queued",
  running: "toolStatus.running",
  succeeded: "toolStatus.succeeded",
  failed: "toolStatus.failed",
  cancelled: "toolStatus.cancelled",
} as const satisfies Record<ToolRunStatus, string>;

const STATUS_COLORS: Record<ToolRunStatus, ChipProps["color"]> = {
  queued: "default",
  running: "primary",
  succeeded: "success",
  failed: "error",
  cancelled: "default",
};

const RESULT_MAX_CHARS = 4000;

type ToolRunCardProps = {
  toolRun: ToolRun;
};

export function ToolRunCard({ toolRun }: ToolRunCardProps): React.JSX.Element {
  const { classes } = useStyles();
  const { t } = useTranslation("agentChat");
  const [expanded, setExpanded] = useState(false);

  const progress = useMemo(() => {
    if (toolRun.progress == undefined) {
      return undefined;
    }
    return Math.max(0, Math.min(100, toolRun.progress));
  }, [toolRun.progress]);

  const showProgress = toolRun.status === "running" || progress != undefined;
  const hasError = toolRun.error != undefined;

  // Failed runs are always expanded so the error details are never missed.
  useEffect(() => {
    if (hasError) {
      setExpanded(true);
    }
  }, [hasError]);

  const resultText = useMemo(() => {
    if (toolRun.result == undefined) {
      return undefined;
    }
    const serialized =
      typeof toolRun.result === "string"
        ? toolRun.result
        : (JSON.stringify(toolRun.result, null, 2) ?? "");
    if (serialized.length > RESULT_MAX_CHARS) {
      return `${serialized.slice(0, RESULT_MAX_CHARS)}\n… ${t("toolResultTruncated", {
        defaultValue: "Result truncated; showing the first 4000 characters.",
      })}`;
    }
    return serialized;
  }, [toolRun.result, t]);

  return (
    <Paper className={classes.toolCard} variant="outlined">
      <Stack direction="row" alignItems="center" gap={0.5}>
        <IconButton
          className={classes.toolToggleButton}
          size="small"
          aria-expanded={expanded}
          aria-label={t(expanded ? "toolCollapse" : "toolExpand", { name: toolRun.name })}
          onClick={() => {
            setExpanded((current) => !current);
          }}
        >
          {expanded ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
        </IconButton>
        <Typography className={classes.toolName} variant="body2">
          {toolRun.name}
        </Typography>
        <Chip
          className={classes.toolStatusChip}
          size="small"
          color={STATUS_COLORS[toolRun.status]}
          label={t(STATUS_LABEL_KEYS[toolRun.status])}
        />
      </Stack>

      {showProgress && (
        <LinearProgress
          className={classes.progress}
          aria-label={t("toolProgress", { name: toolRun.name })}
          variant={progress == undefined ? "indeterminate" : "determinate"}
          value={progress}
        />
      )}

      <Collapse in={expanded} timeout="auto" unmountOnExit={false}>
        <div className={classes.toolCardBody}>
          {toolRun.summary != undefined && (
            <Typography className={classes.toolSummary} color="text.secondary" variant="body2">
              {toolRun.summary}
            </Typography>
          )}

          {toolRun.error != undefined && (
            <Typography className={classes.toolError} color="error" variant="body2">
              {toolRun.error}
            </Typography>
          )}

          {resultText != undefined && (
            <pre className={classes.toolResult} data-testid="tool-run-result">
              {resultText}
            </pre>
          )}
        </div>
      </Collapse>
    </Paper>
  );
}
