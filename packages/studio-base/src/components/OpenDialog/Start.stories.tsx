// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StoryObj } from "@storybook/react";
import { ReactNode } from "react";

import CurrentUserContext, {
  CurrentUser,
  User,
} from "@foxglove/studio-base/context/CurrentUserContext";
import PlayerSelectionContext, {
  PlayerSelection,
} from "@foxglove/studio-base/context/PlayerSelectionContext";

import OpenDialog, { OpenDialogProps } from "./OpenDialog";

export default {
  title: "components/OpenDialog/Start",
  component: OpenDialog,
  parameters: { colorScheme: "dark" },
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

const defaultProps: OpenDialogProps = { backdropAnimation: false };

export const DefaultLight: StoryObj = {
  render: () => <OpenDialog {...defaultProps} />,
  name: "Default (light)",
  parameters: { colorScheme: "light" },
};

export const DefaultDark: StoryObj = {
  render: () => <OpenDialog {...defaultProps} />,
  name: "Default (dark)",
};

export const UserNoAuth: StoryObj = {
  render: function Story() {
    return (
      <PlayerSelectionContext.Provider value={playerSelection}>
        <OpenDialog {...defaultProps} />
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

export const UserPrivate: StoryObj = {
  render: function Story() {
    return (
      <CurrentUserWrapper>
        <PlayerSelectionContext.Provider value={playerSelection}>
          <OpenDialog {...defaultProps} />
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

export const UserAuthedFree: StoryObj = {
  render: function Story() {
    const freeUser = fakeUser("free");

    return (
      <CurrentUserWrapper user={freeUser}>
        <PlayerSelectionContext.Provider value={playerSelection}>
          <OpenDialog {...defaultProps} />
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

export const UserAuthedPaid: StoryObj = {
  render: function Story() {
    const freeUser = fakeUser("paid");

    return (
      <CurrentUserWrapper user={freeUser}>
        <PlayerSelectionContext.Provider value={playerSelection}>
          <OpenDialog {...defaultProps} />
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
