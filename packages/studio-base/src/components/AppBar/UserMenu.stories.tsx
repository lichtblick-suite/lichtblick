// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StoryObj } from "@storybook/react";

import { AppBar } from "@foxglove/studio-base/components/AppBar";
import { StorybookDecorator } from "@foxglove/studio-base/components/AppBar/StorybookDecorator.stories";
import { UserMenu } from "@foxglove/studio-base/components/AppBar/UserMenu";
import Stack from "@foxglove/studio-base/components/Stack";
import CurrentUserContext, { User } from "@foxglove/studio-base/context/CurrentUserContext";

export default {
  title: "components/AppBar/UserMenu",
  component: AppBar,
  decorators: [StorybookDecorator],
};

function MenuStory({ top, left }: { top: number; left: number }) {
  return (
    <UserMenu
      open
      anchorPosition={{ top, left }}
      anchorReference="anchorPosition"
      handleClose={() => {
        // no-op
      }}
    />
  );
}

function SignInStates(): JSX.Element {
  const currentUser: User = {
    id: "user-1",
    email: "user@example.com",
    orgId: "org_id",
    orgDisplayName: "Orgalorg",
    orgSlug: "org",
    orgPaid: false,
    org: {
      id: "org_id",
      slug: "org",
      displayName: "Orgalorg",
      isEnterprise: false,
      allowsUploads: true,
      supportsEdgeSites: false,
    },
  };

  return (
    <Stack direction="row" padding={2}>
      <div style={{ width: 224, paddingLeft: 16 }}>sign in undefined</div>
      <div style={{ width: 224, paddingLeft: 16 }}>no user present</div>
      <div style={{ width: 240, paddingLeft: 16 }}>user present</div>
      <MenuStory top={44} left={16} />
      <CurrentUserContext.Provider
        value={{
          currentUser: undefined,
          signIn: () => undefined,
          signOut: async () => undefined,
        }}
      >
        <MenuStory top={44} left={240} />
      </CurrentUserContext.Provider>
      <CurrentUserContext.Provider
        value={{
          currentUser,
          signIn: () => undefined,
          signOut: async () => undefined,
        }}
      >
        <MenuStory top={44} left={464} />
      </CurrentUserContext.Provider>
    </Stack>
  );
}

export const Dark: StoryObj = {
  render: () => <SignInStates />,
  parameters: { colorScheme: "dark" },
};

export const Light: StoryObj = {
  render: () => <SignInStates />,
  parameters: { colorScheme: "light" },
};
