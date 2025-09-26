// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Button, Typography } from "@mui/material";
import { Component, ErrorInfo, PropsWithChildren, ReactNode } from "react";

import Stack from "@lichtblick/suite-base/components/Stack";
import {
  PanelErrorBoundaryProps,
  PanelErrorBoundaryState,
} from "@lichtblick/suite-base/components/types";
import { reportError } from "@lichtblick/suite-base/reportError";
import { AppError } from "@lichtblick/suite-base/util/errors";

export default class PanelErrorBoundary extends Component<
  PropsWithChildren<PanelErrorBoundaryProps>,
  PanelErrorBoundaryState
> {
  public override state: PanelErrorBoundaryState = {
    currentError: undefined,
  };

  public static getDerivedStateFromError(error: Error): Partial<PanelErrorBoundaryState> {
    return { currentError: { error, errorInfo: {} as ErrorInfo } };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    reportError(new AppError(error, errorInfo));
    this.setState({ currentError: { error, errorInfo } });

    if (this.props.onLogError) {
      this.props.onLogError(`Panel render error: ${error.message}`, error);
    }
  }

  public override render(): ReactNode {
    if (this.state.currentError) {
      // Show a minimal fallback UI for render errors
      return (
        <Stack fullHeight padding={2} alignItems="center" justifyContent="center">
          <Typography variant="body2" color="error" align="center" gutterBottom>
            Panel encountered a render error
          </Typography>
          <Typography variant="caption" color="text.secondary" align="center" gutterBottom>
            Error: {this.state.currentError.error.message}
          </Typography>
          <Typography variant="caption" color="text.secondary" align="center" gutterBottom>
            Check the panel logs for details.
          </Typography>
          <Stack direction="row" gap={1} style={{ marginTop: 8 }}>
            <Button
              size="small"
              variant="outlined"
              onClick={() => {
                this.setState({ currentError: undefined });
              }}
            >
              Try Again
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="error"
              onClick={() => {
                this.setState({ currentError: undefined });
                this.props.onResetPanel();
              }}
            >
              Reset Panel
            </Button>
          </Stack>
        </Stack>
      );
    }

    return this.props.children;
  }
}
