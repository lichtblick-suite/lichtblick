// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Box, Button, Link, Stack } from "@mui/material";
import { Component, ErrorInfo, PropsWithChildren, ReactNode } from "react";

import { reportError } from "@foxglove/studio-base/reportError";
import { AppError } from "@foxglove/studio-base/util/errors";

import ErrorDisplay from "./ErrorDisplay";

type Props = {
  showErrorDetails?: boolean;
  hideErrorSourceLocations?: boolean;
  onResetPanel: () => void;
  onRemovePanel: () => void;
};

type State = {
  currentError: { error: Error; errorInfo: ErrorInfo } | undefined;
};

export default class PanelErrorBoundary extends Component<PropsWithChildren<Props>, State> {
  public override state: State = {
    currentError: undefined,
  };

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    reportError(new AppError(error, errorInfo));
    this.setState({ currentError: { error, errorInfo } });
  }

  public override render(): ReactNode {
    if (this.state.currentError) {
      return (
        <ErrorDisplay
          title="This panel encountered an unexpected error"
          error={this.state.currentError.error}
          errorInfo={this.state.currentError.errorInfo}
          showErrorDetails={this.props.showErrorDetails}
          hideErrorSourceLocations={this.props.hideErrorSourceLocations}
          content={
            <p>
              Something went wrong in this panel.{" "}
              <Link color="inherit" onClick={() => this.setState({ currentError: undefined })}>
                Dismiss this error
              </Link>{" "}
              to continue using this panel. If the issue persists, try resetting the panel.
            </p>
          }
          actions={
            <>
              <Stack direction="row" spacing={1}>
                <Box flexGrow={1} />
                <Button
                  variant="text"
                  title="Remove this panel from the layout"
                  color="error"
                  onClick={this.props.onRemovePanel}
                >
                  Remove Panel
                </Button>
                <Button
                  variant="outlined"
                  title="Reset panel settings to default values"
                  color="error"
                  onClick={() => {
                    this.setState({ currentError: undefined });
                    this.props.onResetPanel();
                  }}
                >
                  Reset Panel
                </Button>
                <Button
                  variant="outlined"
                  color="secondary"
                  onClick={() => this.setState({ currentError: undefined })}
                >
                  Dismiss
                </Button>
              </Stack>
            </>
          }
        />
      );
    }
    return this.props.children;
  }
}
