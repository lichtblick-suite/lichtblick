// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import SidebarButton from "./SidebarButton";

export default {
  title: "components/Sidebar/SidebarButton",
  component: SidebarButton,
};

export const EmptyCount = (): JSX.Element => {
  return (
    <SidebarButton
      iconProps={{ iconName: "Edit" }}
      dataSidebarKey=""
      selected={false}
      title="Title"
      badge={{ count: undefined }}
    />
  );
};

export const TwoCount = (): JSX.Element => {
  return (
    <SidebarButton
      iconProps={{ iconName: "Edit" }}
      dataSidebarKey=""
      selected={false}
      title="Title"
      badge={{ count: 2 }}
    />
  );
};

export const TwentyTwoCount = (): JSX.Element => {
  return (
    <SidebarButton
      iconProps={{ iconName: "Edit" }}
      dataSidebarKey=""
      selected={false}
      title="Title"
      badge={{ count: 22 }}
    />
  );
};
