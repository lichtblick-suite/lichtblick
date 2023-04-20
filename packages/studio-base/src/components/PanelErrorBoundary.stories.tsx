// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { action } from "@storybook/addon-actions";
import { StoryObj } from "@storybook/react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

import PanelErrorBoundary from "./PanelErrorBoundary";

class Broken extends React.Component {
  public override render() {
    throw Object.assign(new Error("Hello!"), {
      stack: `
  an error occurred
  it's caught by this component
  now the user sees
      `,
    });
    return ReactNull;
  }
}

export default {
  title: "components/PanelErrorBoundary",
};

export const Default: StoryObj = {
  render: () => {
    return (
      <DndProvider backend={HTML5Backend}>
        <PanelErrorBoundary
          onRemovePanel={action("onRemovePanel")}
          onResetPanel={action("onResetPanel")}
        >
          <Broken />
        </PanelErrorBoundary>
      </DndProvider>
    );
  },
};

export const ShowingDetails: StoryObj = {
  render: () => {
    return (
      <DndProvider backend={HTML5Backend}>
        <PanelErrorBoundary
          showErrorDetails
          hideErrorSourceLocations
          onRemovePanel={action("onRemovePanel")}
          onResetPanel={action("onResetPanel")}
        >
          <Broken />
        </PanelErrorBoundary>
      </DndProvider>
    );
  },
};
