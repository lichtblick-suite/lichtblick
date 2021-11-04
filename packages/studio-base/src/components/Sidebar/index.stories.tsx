// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useEffect, useState } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

import Sidebar, { SidebarItem } from ".";

export default {
  title: "components/Sidebar",
  component: Sidebar,
};

const A = () => <>A</>;
const B = () => <>B</>;
const C = () => <>C</>;
const D = () => <>D</>;
const E = () => <>E</>;

const ITEMS = new Map<string, SidebarItem>([
  ["a", { title: "A", component: A, iconName: "Add" }],
  ["b", { title: "B", component: B, iconName: "ErrorBadge" }],
  ["c", { title: "C", component: C, iconName: "Cancel" }],
  ["d", { title: "D", component: D, iconName: "Delete" }],
  ["e", { title: "E", component: E, badge: { count: 2 }, iconName: "Edit" }],
]);

const BOTTOM_ITEMS = ["b"];

function Story({
  clickKey,
  defaultSelectedKey,
  height = 300,
}: {
  clickKey?: string;
  defaultSelectedKey?: string | undefined;
  height?: number;
}) {
  const [selectedKey, setSelectedKey] = useState<string | undefined>(defaultSelectedKey);

  useEffect(() => {
    if (clickKey != undefined) {
      void (async () => {
        // Give the ResizeGroup some time to show the overflow button, to avoid flaky screenshot tests
        for (let i = 0; i < 10; i++) {
          await new Promise((resolve) => setTimeout(resolve, 10));
          const button = document.querySelector<HTMLButtonElement>(
            `button[data-sidebar-key=${clickKey}]`,
          );
          if (button) {
            button.click();
            return;
          }
        }
        setSelectedKey(() => {
          throw new Error("Missing sidebar button");
        });
      })();
    }
  }, [clickKey]);

  return (
    <DndProvider backend={HTML5Backend}>
      <div style={{ width: 300, height }}>
        <Sidebar
          items={ITEMS}
          bottomItems={BOTTOM_ITEMS}
          selectedKey={selectedKey}
          onSelectKey={setSelectedKey}
        >
          Main content
        </Sidebar>
      </div>
    </DndProvider>
  );
}

export const Unselected = (): JSX.Element => <Story />;
export const ASelected = (): JSX.Element => <Story defaultSelectedKey="a" />;
export const BSelected = (): JSX.Element => <Story defaultSelectedKey="b" />;

export const ClickToSelect = (): JSX.Element => <Story clickKey="a" />;
ClickToSelect.parameters = { colorScheme: "dark" };
export const ClickToDeselect = (): JSX.Element => <Story defaultSelectedKey="a" clickKey="a" />;
ClickToDeselect.parameters = { colorScheme: "dark" };

export const OverflowUnselected = (): JSX.Element => <Story height={200} />;
export const OverflowCSelected = (): JSX.Element => <Story height={200} defaultSelectedKey="c" />;
export const OverflowBSelected = (): JSX.Element => <Story height={200} defaultSelectedKey="b" />;

export const OverflowMenuUnselected = (): JSX.Element => (
  <Story height={200} clickKey="_overflow" />
);
OverflowMenuUnselected.parameters = { colorScheme: "dark" };

export const OverflowMenuSelected = (): JSX.Element => (
  <Story height={200} defaultSelectedKey="d" clickKey="_overflow" />
);
OverflowMenuSelected.parameters = { colorScheme: "dark" };
