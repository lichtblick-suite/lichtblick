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

import { storiesOf } from "@storybook/react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

import StoreSetup from "@foxglove/studio-base/stories/StoreSetup";

import ErrorBoundary from "./ErrorBoundary";

class Broken extends React.Component {
  render() {
    throw {
      stack: `
  an error occurred
  it's caught by this component
  now the user sees
      `,
    };
    return ReactNull;
  }
}

storiesOf("components/ErrorBoundary", module).add("examples", () => {
  return (
    <DndProvider backend={HTML5Backend}>
      <StoreSetup>
        <ErrorBoundary hideSourceLocations>
          <Broken />
        </ErrorBoundary>
      </StoreSetup>
    </DndProvider>
  );
});
