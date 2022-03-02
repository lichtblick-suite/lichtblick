// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Link, Stack, Button, Box } from "@mui/material";
import { captureException } from "@sentry/core";
import { Component, ErrorInfo, PropsWithChildren, ReactNode } from "react";

import { AppError } from "@foxglove/studio-base/util/errors";

import ErrorDisplay from "./ErrorDisplay";

type Props = {
  actions?: JSX.Element;
  showErrorDetails?: boolean;
};

type State = {
  currentError: { error: Error; errorInfo: ErrorInfo } | undefined;
};

export default class ErrorBoundary extends Component<PropsWithChildren<Props>, State> {
  override state: State = {
    currentError: undefined,
  };

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    captureException(new AppError(error, errorInfo));
    this.setState({ currentError: { error, errorInfo } });
  }

  override render(): ReactNode {
    if (this.state.currentError) {
      const actions = this.props.actions ?? (
        <Stack direction="row" spacing={1}>
          <Box flexGrow={1} />
          <Button
            variant="outlined"
            color="secondary"
            onClick={() => this.setState({ currentError: undefined })}
          >
            Dismiss
          </Button>
        </Stack>
      );
      return (
        <ErrorDisplay
          showErrorDetails={this.props.showErrorDetails}
          error={this.state.currentError.error}
          errorInfo={this.state.currentError.errorInfo}
          content={
            <p>
              Something went wrong.{" "}
              <Link color="inherit" onClick={() => this.setState({ currentError: undefined })}>
                Dismiss this error
              </Link>{" "}
              to continue using the app. If the issue persists, try restarting the app.
            </p>
          }
          actions={actions}
        />
      );
    }
    return this.props.children;
  }
}
