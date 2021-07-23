// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { makeStyles, MessageBar, MessageBarType, Stack, Text, useTheme } from "@fluentui/react";
import { captureException } from "@sentry/core";
import { createContext, ErrorInfo, useContext } from "react";

import { AppError } from "@foxglove/studio-base/util/errors";

const useStyles = makeStyles((theme) => ({
  wrapper: {
    overflow: "hidden",
  },
  header: {
    fontWeight: "bold",
    marginBottom: theme.spacing.s1,
  },
  content: {
    overflow: "auto",
    padding: theme.spacing.s1,
    backgroundColor: theme.palette.neutralLighterAlt,
  },
  stack: {
    fontSize: theme.fonts.small.fontSize,
    marginLeft: theme.spacing.m,
    lineHeight: "1.3em",
  },
  sourceLocation: {
    color: theme.palette.neutralLight,
  },
}));

function ErrorDisplay(props: ErrorRendererProps) {
  const styles = useStyles();
  return (
    <Stack className={styles.wrapper}>
      <MessageBar
        messageBarType={MessageBarType.error}
        dismissIconProps={{ iconName: "Refresh" }}
        dismissButtonAriaLabel="Reset"
        onDismiss={props.onDismiss}
      >
        {props.error.toString()}
      </MessageBar>
      {defaultRenderErrorDetails(props)}
    </Stack>
  );
}

function sanitizeStack(stack: string) {
  return stack
    .replace(/\s+\(.+\)$/gm, " (some location)")
    .replace(/\s+https?:\/\/.+$/gm, " some location");
}

function ErrorStack({ stack }: { stack: string }) {
  const hideSourceLocations = useContext(HideErrorSourceLocations);
  const styles = useStyles();
  const lines = (hideSourceLocations ? sanitizeStack(stack) : stack)
    .trim()
    .replace(/^\s*at /gm, "")
    .split("\n")
    .map((line) => line.trim());
  return (
    <pre className={styles.stack}>
      {lines.map((line, i) => {
        const match = /^(.+)\s(\(.+$)/.exec(line);
        if (!match) {
          return line + "\n";
        }
        return (
          <span key={i}>
            <span>{match[1]} </span>
            <span className={styles.sourceLocation}>{match[2]}</span>
            {"\n"}
          </span>
        );
      })}
    </pre>
  );
}

function ErrorDetailsDisplay({ error, errorInfo }: ErrorRendererProps) {
  const styles = useStyles();
  const theme = useTheme();
  let stackWithoutMessage = error.stack ?? "";
  const errorString = error.toString() ?? "";
  if (stackWithoutMessage.startsWith(errorString)) {
    stackWithoutMessage = stackWithoutMessage.substring(errorString.length);
  }
  return (
    <Stack className={styles.content} tokens={{ childrenGap: theme.spacing.m }}>
      <Stack.Item>
        <Text block className={styles.header} variant="large" as="h2">
          Error stack:
        </Text>
        <ErrorStack stack={stackWithoutMessage} />
      </Stack.Item>
      <Stack.Item>
        <Text block className={styles.header} variant="large" as="h2">
          Component stack:
        </Text>
        <ErrorStack stack={errorInfo.componentStack} />
      </Stack.Item>
    </Stack>
  );
}

export type ErrorRendererProps = {
  error: Error;
  errorInfo: ErrorInfo;
  onDismiss: () => void;
  defaultRenderError: (_: ErrorRendererProps) => JSX.Element;
  defaultRenderErrorDetails: (_: ErrorRendererProps) => JSX.Element;
};

type Props = {
  children: React.ReactNode;
  renderError: (_: ErrorRendererProps) => React.ReactNode;
};
type State = {
  currentError: { error: Error; errorInfo: ErrorInfo } | undefined;
};

function defaultRenderError(props: ErrorRendererProps): JSX.Element {
  return <ErrorDisplay {...props} />;
}
function defaultRenderErrorDetails(props: ErrorRendererProps): JSX.Element {
  return <ErrorDetailsDisplay {...props} />;
}

export const HideErrorSourceLocations = createContext(false);

export default class ErrorBoundary extends React.Component<Props, State> {
  override state: State = {
    currentError: undefined,
  };

  static defaultProps = {
    renderError: defaultRenderError,
  };

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    captureException(new AppError(error, errorInfo));
    this.setState({ currentError: { error, errorInfo } });
  }

  override render(): React.ReactNode {
    if (this.state.currentError) {
      return this.props.renderError({
        ...this.state.currentError,
        onDismiss: () => this.setState({ currentError: undefined }),
        defaultRenderError,
        defaultRenderErrorDetails,
      });
    }
    return this.props.children;
  }
}
