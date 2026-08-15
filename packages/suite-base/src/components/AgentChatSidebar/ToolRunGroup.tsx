// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import {
  BuildOutlined,
  CheckCircleOutline,
  ErrorOutline,
  KeyboardArrowDown,
  KeyboardArrowUp,
  WarningAmber,
} from "@mui/icons-material";
import { ButtonBase, CircularProgress, Collapse, Paper, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { makeStyles } from "tss-react/mui";

import type { ToolRun } from "@lichtblick/suite-base/services/agent/types";

import { ToolRunCard } from "./ToolRunCard";

const useStyles = makeStyles()((theme) => ({
  root: {
    marginTop: theme.spacing(1),
    overflow: "hidden",
    color: theme.palette.text.primary,
    backgroundColor: theme.palette.background.paper,
  },
  warning: {
    borderColor: theme.palette.warning.main,
  },
  error: {
    borderColor: theme.palette.error.main,
  },
  header: {
    display: "flex",
    width: "100%",
    alignItems: "center",
    gap: theme.spacing(0.75),
    padding: theme.spacing(0.75, 1),
    color: "inherit",
    textAlign: "left",
  },
  toggleIcon: {
    flex: "none",
    color: theme.palette.text.secondary,
  },
  processIcon: {
    flex: "none",
    color: theme.palette.text.secondary,
  },
  title: {
    flex: 1,
    minWidth: 0,
  },
  status: {
    display: "flex",
    flex: "none",
    alignItems: "center",
    gap: theme.spacing(0.5),
    color: theme.palette.text.secondary,
  },
  warningStatus: {
    color: theme.palette.warning.main,
  },
  errorStatus: {
    color: theme.palette.error.main,
  },
  body: {
    padding: theme.spacing(0, 1, 1),
  },
}));

type ToolRunGroupProps = {
  toolRuns: readonly ToolRun[];
};

function hasError(toolRun: ToolRun): boolean {
  return toolRun.status === "failed" || toolRun.error != undefined;
}

export function ToolRunGroup({ toolRuns }: ToolRunGroupProps): React.JSX.Element | null {
  const { classes, cx } = useStyles();
  const { t } = useTranslation("agentChat");
  const attentionKey = toolRuns
    .filter((toolRun) => toolRun.status === "awaiting-confirmation" || hasError(toolRun))
    .map((toolRun) => `${toolRun.id}:${toolRun.status}:${toolRun.error ?? ""}`)
    .join("|");
  const [expanded, setExpanded] = useState(attentionKey.length > 0);

  useEffect(() => {
    if (attentionKey.length > 0) {
      setExpanded(true);
    }
  }, [attentionKey]);

  const groupStatus = useMemo(() => {
    if (toolRuns.some(hasError)) {
      return "error";
    }
    if (toolRuns.some((toolRun) => toolRun.status === "awaiting-confirmation")) {
      return "awaiting-confirmation";
    }
    if (toolRuns.some((toolRun) => toolRun.status === "running" || toolRun.status === "queued")) {
      return "running";
    }
    return "complete";
  }, [toolRuns]);

  if (toolRuns.length === 0) {
    return null;
  }

  return (
    <Paper
      className={cx(classes.root, {
        [classes.warning]: groupStatus === "awaiting-confirmation",
        [classes.error]: groupStatus === "error",
      })}
      data-testid="tool-run-group"
      variant="outlined"
    >
      <ButtonBase
        aria-expanded={expanded}
        aria-label={t(expanded ? "executionCollapse" : "executionExpand")}
        className={classes.header}
        onClick={() => {
          setExpanded((current) => !current);
        }}
      >
        {expanded ? (
          <KeyboardArrowUp className={classes.toggleIcon} fontSize="small" />
        ) : (
          <KeyboardArrowDown className={classes.toggleIcon} fontSize="small" />
        )}
        <BuildOutlined className={classes.processIcon} fontSize="small" />
        <Typography className={classes.title} component="span" variant="body2">
          {t("executionProcess")} ({t("steps", { count: toolRuns.length })})
        </Typography>
        <span
          className={cx(classes.status, {
            [classes.warningStatus]: groupStatus === "awaiting-confirmation",
            [classes.errorStatus]: groupStatus === "error",
          })}
        >
          {groupStatus === "running" && (
            <>
              <CircularProgress aria-label={t("executionRunning")} color="inherit" size={14} />
              <Typography color="inherit" component="span" variant="caption">
                {t("executionRunning")}
              </Typography>
            </>
          )}
          {groupStatus === "awaiting-confirmation" && (
            <>
              <WarningAmber fontSize="small" />
              <Typography color="inherit" component="span" variant="caption">
                {t("awaitingConfirmation")}
              </Typography>
            </>
          )}
          {groupStatus === "error" && (
            <>
              <ErrorOutline fontSize="small" />
              <Typography color="inherit" component="span" variant="caption">
                {t("executionFailed")}
              </Typography>
            </>
          )}
          {groupStatus === "complete" && (
            <>
              <CheckCircleOutline fontSize="small" />
              <Typography color="inherit" component="span" variant="caption">
                {t("executionComplete")}
              </Typography>
            </>
          )}
        </span>
      </ButtonBase>
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <div className={classes.body} role="list">
          {toolRuns.map((toolRun) => (
            <div key={toolRun.id} role="listitem">
              <ToolRunCard toolRun={toolRun} />
            </div>
          ))}
        </div>
      </Collapse>
    </Paper>
  );
}
