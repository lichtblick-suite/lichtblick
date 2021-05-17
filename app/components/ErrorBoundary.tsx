// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { captureException } from "@sentry/electron";
import { ErrorInfo } from "react";
import styled from "styled-components";

import Button from "@foxglove/studio-base/components/Button";
import Flex from "@foxglove/studio-base/components/Flex";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import { AppError } from "@foxglove/studio-base/util/errors";

const Heading = styled.div`
  font-size: 1.2em;
  font-weight: bold;
  color: coral;
  margin-top: 0.5em;
`;

const ErrorBanner = styled.div`
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  color: white;
  background-color: red;
  padding: 2px 5px;
`;

type State = {
  error?: Error;
  errorInfo?: any;
};

export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode; hideSourceLocations?: boolean },
  State
> {
  state: State = {
    error: undefined,
    errorInfo: undefined,
  };

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    captureException(new AppError(error, errorInfo));
    this.setState({ error, errorInfo });
  }

  render(): React.ReactNode {
    const { error, errorInfo } = this.state;
    if (error) {
      let name = "this panel";
      if (errorInfo && typeof errorInfo.componentStack === "string") {
        const matches = errorInfo.componentStack.match(/^\s*at ([\w()]+) \(/);
        if (matches && matches.length > 0) {
          name = matches[1];
        }
      }
      return (
        <Flex col style={{ maxHeight: "100%", maxWidth: "100%" }}>
          <PanelToolbar>
            <ErrorBanner>
              <div style={{ flexGrow: 1 }}>An error occurred in {name}.</div>
              <Button
                style={{ background: "rgba(255, 255, 255, 0.5)" }}
                onClick={() => this.setState({ error: undefined, errorInfo: undefined })}
              >
                Reload Panel
              </Button>
            </ErrorBanner>
          </PanelToolbar>
          <Flex col scroll scrollX style={{ padding: "2px 6px" }}>
            <Heading>Error stack:</Heading>
            <pre>{error.stack}</pre>
            <Heading>Component stack:</Heading>
            <pre>
              {this.props.hideSourceLocations ?? false
                ? errorInfo?.componentStack
                    .replace(/\s+\(.+\)$/gm, "")
                    .replace(/\s+https?:\/\/.+$/gm, "")
                : errorInfo?.componentStack}
            </pre>
          </Flex>
        </Flex>
      );
    }
    return this.props.children;
  }
}
