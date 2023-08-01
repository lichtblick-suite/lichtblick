// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StoryFn, StoryObj } from "@storybook/react";

import MockCurrentLayoutProvider from "@foxglove/studio-base/providers/CurrentLayoutProvider/MockCurrentLayoutProvider";
import WorkspaceContextProvider from "@foxglove/studio-base/providers/WorkspaceContextProvider";

import { DataSourceDialog } from "./DataSourceDialog";

const Wrapper = (Story: StoryFn): JSX.Element => {
  return (
    <MockCurrentLayoutProvider>
      <WorkspaceContextProvider
        initialState={{
          dialogs: {
            dataSource: {
              activeDataSource: undefined,
              item: "start",
              open: true,
            },
            preferences: {
              initialTab: undefined,
              open: false,
            },
          },
        }}
      >
        <Story />
      </WorkspaceContextProvider>
    </MockCurrentLayoutProvider>
  );
};

export default {
  title: "components/DataSourceDialog",
  component: DataSourceDialog,
  decorators: [Wrapper],
};

export const DefaultLight: StoryObj = {
  render: () => <DataSourceDialog />,
  parameters: { colorScheme: "light" },
  name: "Default (light)",
};

export const DefaultDark: StoryObj = {
  render: () => <DataSourceDialog />,
  parameters: { colorScheme: "dark" },
  name: "Default (dark)",
};
