// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Link, Button, Typography } from "@mui/material";
import { Component, ErrorInfo, PropsWithChildren, ReactNode } from "react";

import Stack from "@foxglove/studio-base/components/Stack";
import { reportError } from "@foxglove/studio-base/reportError";
import { AppError } from "@foxglove/studio-base/util/errors";

import ErrorDisplay from "./ErrorDisplay";

type Props = {
  actions?: JSX.Element;
  showErrorDetails?: boolean;
  hideErrorSourceLocations?: boolean;
};

type State = {
  currentError: { error: Error; errorInfo: ErrorInfo } | undefined;
};

export default class ErrorBoundary extends Component<PropsWithChildren<Props>, State> {
  public override state: State = {
    currentError: undefined,
  };

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    reportError(new AppError(error, errorInfo));
    this.setState({ currentError: { error, errorInfo } });
  }

  public override render(): ReactNode {
    if (this.state.currentError) {
      const actions = this.props.actions ?? (
        <Stack
          fullHeight
          flex="auto"
          alignItems="flex-end"
          justifyContent="flex-end"
          direction="row"
        >
          <Button
            variant="outlined"
            color="secondary"
            onClick={() => {
              this.setState({ currentError: undefined });
            }}
          >
            Dismiss
          </Button>
        </Stack>
      );
      return (
        <ErrorDisplay
          showErrorDetails={this.props.showErrorDetails}
          hideErrorSourceLocations={this.props.hideErrorSourceLocations}
          error={this.state.currentError.error}
          errorInfo={this.state.currentError.errorInfo}
          content={
            <Typography>
              Something went wrong.{" "}
              <Link
                color="inherit"
                onClick={() => {
                  this.setState({ currentError: undefined });
                }}
              >
                Dismiss this error
              </Link>{" "}
              to continue using the app. If the issue persists, try restarting the app.
            </Typography>
          }
          actions={actions}
        />
      );
    }
    return this.props.children;
  }
}
