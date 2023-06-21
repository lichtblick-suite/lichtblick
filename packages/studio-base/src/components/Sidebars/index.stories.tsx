// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StoryObj } from "@storybook/react";
import { useEffect, useState } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

import { AppSetting } from "@foxglove/studio-base/AppSetting";
import AppConfigurationContext from "@foxglove/studio-base/context/AppConfigurationContext";
import { useAppConfigurationValue } from "@foxglove/studio-base/hooks";
import { makeMockAppConfiguration } from "@foxglove/studio-base/util/makeMockAppConfiguration";

import Sidebars, { SidebarItem } from ".";

export default {
  title: "components/Sidebar",
  component: Sidebars,
};

const A = () => <>A</>;
const B = () => <>B</>;
const C = () => <>C</>;
const D = () => <>D</>;
const E = () => <>E</>;

const ITEMS = new Map<string, SidebarItem>([
  ["a", { title: "A", component: A, iconName: "Add" }],
  ["c", { title: "C", component: C, iconName: "Cancel" }],
  ["d", { title: "D", component: D, iconName: "Delete" }],
  ["e", { title: "E", component: E, badge: { count: 2 }, iconName: "Edit" }],
]);

const BOTTOM_ITEMS = new Map<string, SidebarItem>([
  ["b", { title: "B", component: B, iconName: "ErrorBadge" }],
]);

function Story({
  clickKey,
  defaultSelectedKey,
  enableAppBar,
  height = 300,
}: {
  clickKey?: string;
  defaultSelectedKey?: string | undefined;
  enableAppBar?: boolean;
  height?: number;
}) {
  const [selectedKey, setSelectedKey] = useState<string | undefined>(defaultSelectedKey);
  const [_, setAppBarEnabled] = useAppConfigurationValue<boolean>(AppSetting.ENABLE_NEW_TOPNAV);

  useEffect(() => {
    if (enableAppBar === true) {
      void setAppBarEnabled(true);
    }
  }, [enableAppBar, setAppBarEnabled]);

  useEffect(() => {
    if (clickKey != undefined) {
      void (async () => {
        const button = document.querySelector<HTMLButtonElement>(
          `button[data-sidebar-key=${clickKey}]`,
        );
        if (button) {
          button.click();
          return;
        }
        setSelectedKey(() => {
          throw new Error("Missing sidebar button");
        });
      })();
    }
  }, [clickKey]);

  const [appConfig] = useState(() =>
    makeMockAppConfiguration([[AppSetting.ENABLE_NEW_TOPNAV, false]]),
  );

  return (
    <AppConfigurationContext.Provider value={appConfig}>
      <DndProvider backend={HTML5Backend}>
        <div style={{ height }}>
          <Sidebars
            items={ITEMS}
            bottomItems={BOTTOM_ITEMS}
            rightItems={new Map()}
            leftItems={new Map()}
            selectedKey={selectedKey}
            onSelectKey={setSelectedKey}
            selectedRightKey={undefined}
            onSelectRightKey={() => {}}
            selectedLeftKey={undefined}
            onSelectLeftKey={() => {}}
            leftSidebarSize={undefined}
            rightSidebarSize={undefined}
            setLeftSidebarSize={() => {}}
            setRightSidebarSize={() => {}}
          >
            Main content
          </Sidebars>
        </div>
      </DndProvider>
    </AppConfigurationContext.Provider>
  );
}

export const Unselected: StoryObj = {
  render: () => <Story />,
};

export const ASelected: StoryObj = { render: () => <Story defaultSelectedKey="a" /> };
export const BSelected: StoryObj = { render: () => <Story defaultSelectedKey="b" /> };

export const ClickToSelect: StoryObj = {
  render: () => <Story clickKey="a" />,
  parameters: { colorScheme: "dark" },
};

export const ClickToDeselect: StoryObj = {
  render: () => <Story defaultSelectedKey="a" clickKey="a" />,
  parameters: { colorScheme: "dark" },
};

export const OverflowUnselected: StoryObj = { render: () => <Story height={200} /> };
export const OverflowCSelected: StoryObj = {
  render: () => <Story height={200} defaultSelectedKey="c" />,
};
export const OverflowBSelected: StoryObj = {
  render: () => <Story height={200} defaultSelectedKey="b" />,
};
