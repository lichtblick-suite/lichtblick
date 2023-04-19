// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Story } from "@storybook/react";
import { fireEvent } from "@storybook/testing-library";
import { v4 as uuid } from "uuid";

import Panel from "@foxglove/studio-base/components/Panel";
import {
  PanelContextMenu,
  PanelContextMenuItem,
} from "@foxglove/studio-base/components/PanelContextMenu";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";

export default {
  title: "components/PanelContextMenu",
};

const DUMMY_CLASS = uuid();

function DummyPanel(): JSX.Element {
  const items: PanelContextMenuItem[] = [
    { type: "item", label: "Download Image", onclick: () => undefined },
    { type: "item", label: "Flip Horizontal", onclick: () => undefined },
    { type: "item", label: "Flip Vertical", onclick: () => undefined },
  ];

  return (
    <>
      <PanelToolbar />
      <PanelContextMenu itemsForClickPosition={() => items} />
      <div
        className={DUMMY_CLASS}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
        }}
      >
        <p>Panel Context Menu</p>
      </div>
    </>
  );
}

const Dummy = Panel(
  Object.assign(DummyPanel, {
    panelType: "ImageViewPanel",
    defaultConfig: {},
  }),
);

export const Default: Story = () => {
  return (
    <PanelSetup>
      <Dummy></Dummy>
    </PanelSetup>
  );
};

Default.play = () => {
  Array.from(document.getElementsByClassName(DUMMY_CLASS)).forEach((el) => {
    const rect = el.getBoundingClientRect();
    fireEvent.contextMenu(el, { clientX: rect.x + 100, clientY: rect.y + 100 });
  });
};
