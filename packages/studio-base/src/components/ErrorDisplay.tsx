// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Typography, Link, Divider } from "@mui/material";
import { ErrorInfo, useMemo, useState } from "react";
import { makeStyles } from "tss-react/mui";

import Stack from "@foxglove/studio-base/components/Stack";

const useStyles = makeStyles()((theme) => ({
  grid: {
    display: "grid",
    gridTemplateRows: "auto 1fr auto",
    height: "100%",
    padding: theme.spacing(2),
    overflowY: "auto",
  },
  errorDetailStack: {
    fontSize: theme.typography.body2.fontSize,
    lineHeight: "1.3em",
    paddingLeft: theme.spacing(2),
  },
  errorDetailContainer: {
    overflowY: "auto",
    background: theme.palette.background.paper,
    padding: theme.spacing(1),
    minHeight: theme.spacing(10),
  },
  actions: {
    flex: "auto",
    paddingTop: theme.spacing(2),
    textAlign: "right",
  },
}));
/**
 * Remove source locations (which often include file hashes) so storybook screenshots can be
 * deterministic.
 */
function sanitizeStack(stack: string) {
  return stack.replace(/\s+\(.+\)$/gm, "").replace(/\s+https?:\/\/.+$/gm, "");
}

function ErrorStacktrace({
  stack,
  hideSourceLocations,
}: {
  stack: string;
  hideSourceLocations: boolean;
}) {
  const { classes } = useStyles();
  const lines = (hideSourceLocations ? sanitizeStack(stack) : stack)
    .trim()
    .replace(/^\s*at /gm, "")
    .split("\n")
    .map((line) => line.trim());
  return (
    <pre className={classes.errorDetailStack}>
      {lines.map((line, i) => {
        const match = /^(.+)\s(\(.+$)/.exec(line);
        if (!match) {
          return line + "\n";
        }
        return (
          <span key={i}>
            <span>{match[1]} </span>
            <span>{match[2]}</span>
            {"\n"}
          </span>
        );
      })}
    </pre>
  );
}

type ErrorDisplayProps = {
  title?: string;
  error?: Error;
  errorInfo?: ErrorInfo;
  content?: JSX.Element;
  actions?: JSX.Element;
  showErrorDetails?: boolean;
  hideErrorSourceLocations?: boolean;
};

function ErrorDisplay(props: ErrorDisplayProps): JSX.Element {
  const { classes } = useStyles();
  const { error, errorInfo, hideErrorSourceLocations = false } = props;

  const [showErrorDetails, setShowErrorDetails] = useState(props.showErrorDetails ?? false);

  const errorDetails = useMemo(() => {
    if (!showErrorDetails) {
      return ReactNull;
    }

    let stackWithoutMessage = error?.stack ?? "";
    const errorString = error?.toString() ?? "";
    if (stackWithoutMessage.startsWith(errorString)) {
      stackWithoutMessage = stackWithoutMessage.substring(errorString.length);
    }

    return (
      <div>
        <Typography fontWeight="bold">Error stack:</Typography>
        <ErrorStacktrace
          stack={stackWithoutMessage}
          hideSourceLocations={hideErrorSourceLocations}
        />
        {errorInfo && (
          <>
            <Typography fontWeight="bold">Component stack:</Typography>
            <ErrorStacktrace
              stack={errorInfo.componentStack}
              hideSourceLocations={hideErrorSourceLocations}
            />
          </>
        )}
      </div>
    );
  }, [error, errorInfo, hideErrorSourceLocations, showErrorDetails]);

  return (
    <div className={classes.grid}>
      <Stack gap={2} paddingBottom={2}>
        <Stack>
          <Typography variant="h4" gutterBottom>
            {props.title ?? "The app encountered an unexpected error"}
          </Typography>
          <Typography variant="body1">{props.content}</Typography>
        </Stack>
        <Divider />
        <Typography variant="subtitle2" component="code" fontWeight="bold">
          {error?.message}
        </Typography>
        <Link
          color="secondary"
          onClick={() => {
            setShowErrorDetails(!showErrorDetails);
          }}
        >
          {showErrorDetails ? "Hide" : "Show"} details
        </Link>
      </Stack>
      {errorDetails && <div className={classes.errorDetailContainer}>{errorDetails}</div>}
      {!errorDetails && <div />}
      <div className={classes.actions}>{props.actions}</div>
    </div>
  );
}

export default ErrorDisplay;
