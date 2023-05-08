// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StoryFn, StoryObj } from "@storybook/react";
import { ReactNode } from "react";

import CurrentUserContext, {
  CurrentUser,
  User,
} from "@foxglove/studio-base/context/CurrentUserContext";
import PlayerSelectionContext, {
  PlayerSelection,
} from "@foxglove/studio-base/context/PlayerSelectionContext";
import WorkspaceContextProvider from "@foxglove/studio-base/providers/WorkspaceContextProvider";

import { DataSourceDialog } from "./DataSourceDialog";

const Wrapper = (Story: StoryFn): JSX.Element => {
  return (
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
  );
};

export default {
  title: "components/DataSourceDialog/Start",
  component: DataSourceDialog,
  parameters: { colorScheme: "dark" },
  decorators: [Wrapper],
};

function fakeUser(type: "free" | "paid" | "enterprise"): User {
  return {
    id: "user-1",
    email: "user@example.com",
    orgId: "org_id",
    orgDisplayName: "Orgalorg",
    orgSlug: "org",
    orgPaid: type === "paid" || type === "enterprise",
    org: {
      id: "org_id",
      slug: "org",
      displayName: "Orgalorg",
      isEnterprise: type === "enterprise",
      allowsUploads: true,
      supportsEdgeSites: type === "enterprise",
    },
  };
}

// Connection
const playerSelection: PlayerSelection = {
  selectSource: () => {},
  selectRecent: () => {},
  recentSources: [
    {
      id: "1111",
      title: "NuScenes-v1.0-mini-scene-0655-reallllllllly-long-name-8829908290831091.bag",
    },
    {
      id: "2222",
      title: "http://localhost:11311",
      label: "ROS 1",
    },
    {
      id: "3333",
      title: "ws://localhost:9090/",
      label: "Rosbridge (ROS 1 & 2)",
    },
    {
      id: "4444",
      title: "ws://localhost:8765",
      label: "Foxglove WebSocket",
    },
    {
      id: "5555",
      title: "2369",
      label: "Velodyne Lidar",
    },
    {
      id: "6666",
      title: "THIS ITEM SHOULD BE HIDDEN IN STORYBOOKS",
      label: "!!!!!!!!!!!!",
    },
  ],
  availableSources: [
    {
      id: "foo",
      type: "connection",
      displayName: "My Data Source",
      description: "Data source description",
      iconName: "ROS",
      warning: "This is a warning",

      formConfig: {
        fields: [{ id: "key", label: "Some Label" }],
      },

      initialize: () => {
        return undefined;
      },
    },
  ],
};

function CurrentUserWrapper(props: { children: ReactNode; user?: User | undefined }): JSX.Element {
  const value: CurrentUser = {
    currentUser: props.user,
    signIn: () => undefined,
    signOut: async () => undefined,
  };
  return <CurrentUserContext.Provider value={value}>{props.children}</CurrentUserContext.Provider>;
}

const Default = (): JSX.Element => <DataSourceDialog backdropAnimation={false} />;

export const DefaultLight: StoryObj = {
  render: Default,
  name: "Default (light)",
  parameters: { colorScheme: "light" },
};

export const DefaultDark: StoryObj = {
  render: Default,
  name: "Default (dark)",
  parameters: { colorScheme: "dark" },
};

export const UserNoAuth: StoryObj = {
  render: () => {
    return (
      <PlayerSelectionContext.Provider value={playerSelection}>
        <DataSourceDialog backdropAnimation={false} />
      </PlayerSelectionContext.Provider>
    );
  },
  name: "User not authenticated",
};

export const UserNoAuthChinese: StoryObj = {
  ...UserNoAuth,
  name: "User not authenticated Chinese",
  parameters: { forceLanguage: "zh" },
};

export const UserNoAuthJapanese: StoryObj = {
  ...UserNoAuth,
  name: "User not authenticated Japanese",
  parameters: { forceLanguage: "ja" },
};

export const UserPrivate: StoryObj = {
  render: () => {
    return (
      <CurrentUserWrapper>
        <PlayerSelectionContext.Provider value={playerSelection}>
          <DataSourceDialog backdropAnimation={false} />
        </PlayerSelectionContext.Provider>
      </CurrentUserWrapper>
    );
  },
  name: "User not authenticated (private)",
};

export const UserPrivateChinese: StoryObj = {
  ...UserPrivate,
  name: "User not authenticated (private) Chinese",
  parameters: { forceLanguage: "zh" },
};

export const UserPrivateJapanese: StoryObj = {
  ...UserPrivate,
  name: "User not authenticated (private) Japanese",
  parameters: { forceLanguage: "ja" },
};

export const UserAuthedFree: StoryObj = {
  render: () => {
    const freeUser = fakeUser("free");

    return (
      <CurrentUserWrapper user={freeUser}>
        <PlayerSelectionContext.Provider value={playerSelection}>
          <DataSourceDialog backdropAnimation={false} />
        </PlayerSelectionContext.Provider>
      </CurrentUserWrapper>
    );
  },
  name: "User Authenticated with Free Account",
};

export const UserAuthedFreeChinese: StoryObj = {
  ...UserAuthedFree,
  name: "User Authenticated with Free Account Chinese",
  parameters: { forceLanguage: "zh" },
};

export const UserAuthedFreeJapanese: StoryObj = {
  ...UserAuthedFree,
  name: "User Authenticated with Free Account Japanese",
  parameters: { forceLanguage: "ja" },
};

export const UserAuthedPaid: StoryObj = {
  render: () => {
    const freeUser = fakeUser("paid");

    return (
      <CurrentUserWrapper user={freeUser}>
        <PlayerSelectionContext.Provider value={playerSelection}>
          <DataSourceDialog backdropAnimation={false} />
        </PlayerSelectionContext.Provider>
      </CurrentUserWrapper>
    );
  },
  name: "User Authenticated with Paid Account",
};

export const UserAuthedPaidChinese: StoryObj = {
  ...UserAuthedPaid,
  name: "User Authenticated with Paid Account Chinese",
  parameters: { forceLanguage: "zh" },
};

export const UserAuthedPaidJapanese: StoryObj = {
  ...UserAuthedPaid,
  name: "User Authenticated with Paid Account Japanese",
  parameters: { forceLanguage: "ja" },
};
