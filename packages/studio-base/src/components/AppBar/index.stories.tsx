// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { action } from "@storybook/addon-actions";
import { Story } from "@storybook/react";

import { AppBar } from "@foxglove/studio-base/components/AppBar";
import MockMessagePipelineProvider from "@foxglove/studio-base/components/MessagePipeline/MockMessagePipelineProvider";
import Stack from "@foxglove/studio-base/components/Stack";
import { User } from "@foxglove/studio-base/context/CurrentUserContext";
import { PlayerPresence } from "@foxglove/studio-base/players/types";

export default {
  title: "components/AppBar",
  component: AppBar,
  decorators: [Wrapper],
  parameters: {
    colorScheme: "both-column",
  },
};

const actions = {
  signIn: action("signIn"),
  onSelectDataSourceAction: action("onSelectDataSourceAction"),
  onMinimizeWindow: action("onMinimizeWindow"),
  onMaximizeWindow: action("onMaximizeWindow"),
  onUnmaximizeWindow: action("onUnmaximizeWindow"),
  onCloseWindow: action("onCloseWindow"),
};

function Wrapper(StoryFn: Story): JSX.Element {
  return (
    <MockMessagePipelineProvider>
      <StoryFn />
    </MockMessagePipelineProvider>
  );
}

export function Default(): JSX.Element {
  return (
    <AppBar
      signIn={action("signIn")}
      onSelectDataSourceAction={action("onSelectDataSourceAction")}
    />
  );
}

export function CustomWindowControls(): JSX.Element {
  return <AppBar showCustomWindowControls {...actions} />;
}

export function CustomWindowControlsMaximized(): JSX.Element {
  return <AppBar showCustomWindowControls isMaximized {...actions} />;
}

export function CustomWindowControlsDragRegion(): JSX.Element {
  return <AppBar showCustomWindowControls debugDragRegion {...actions} />;
}

export function SignInDisabled(): JSX.Element {
  return <AppBar disableSignIn {...actions} />;
}

export function UserPresent(): JSX.Element {
  const org: User["org"] = {
    id: "fake-orgid",
    slug: "fake-org",
    displayName: "Fake Org",
    isEnterprise: false,
    allowsUploads: false,
    supportsEdgeSites: false,
  };

  const me = {
    id: "fake-userid",
    orgId: org.id,
    orgDisplayName: org.displayName,
    orgSlug: org.slug,
    orgPaid: false,
    email: "foo@example.com",
    org,
  };

  return <AppBar currentUser={me} {...actions} />;
}

function LabeledAppBar({ label }: React.PropsWithChildren<{ label: string }>) {
  return (
    <>
      <div style={{ padding: 8 }}>{label}</div>
      <div>
        <AppBar {...actions} />
      </div>
    </>
  );
}

export function PlayerStates(): JSX.Element {
  return (
    <Stack overflowY="auto">
      <div
        style={{ display: "grid", gridTemplateColumns: "max-content auto", alignItems: "center" }}
      >
        {[
          PlayerPresence.NOT_PRESENT,
          PlayerPresence.INITIALIZING,
          PlayerPresence.RECONNECTING,
          PlayerPresence.BUFFERING,
          PlayerPresence.PRESENT,
          PlayerPresence.ERROR,
        ].map((presence) => (
          <MockMessagePipelineProvider
            key={presence}
            name="https://exampleurl:2002"
            presence={presence}
            problems={
              presence === PlayerPresence.ERROR
                ? [
                    { severity: "error", message: "example error" },
                    { severity: "warn", message: "example warn" },
                  ]
                : undefined
            }
          >
            <LabeledAppBar label={presence} {...actions} />
          </MockMessagePipelineProvider>
        ))}
        <MockMessagePipelineProvider
          name="https://exampleurl:2002"
          presence={PlayerPresence.INITIALIZING}
          problems={[
            { severity: "error", message: "example error" },
            { severity: "warn", message: "example warn" },
          ]}
        >
          <LabeledAppBar label="INITIALIZING + problems" {...actions} />
        </MockMessagePipelineProvider>
      </div>
    </Stack>
  );
}
PlayerStates.parameters = { colorScheme: "light" };

export function DataSources(): JSX.Element {
  return (
    <Stack overflowY="auto">
      <div
        style={{ display: "grid", gridTemplateColumns: "max-content auto", alignItems: "center" }}
      >
        <MockMessagePipelineProvider
          name="roman-transbot (dev_W m1gvryKJmREqnVT)"
          presence={PlayerPresence.PRESENT}
          urlState={{ sourceId: "foxglove-data-platform" }}
        >
          <LabeledAppBar label="foxglove-data-platform" {...actions} />
        </MockMessagePipelineProvider>
        <MockMessagePipelineProvider
          name="Adapted from nuScenes dataset. Copyright © 2020 nuScenes. https://www.nuscenes.org/terms-of-use"
          presence={PlayerPresence.PRESENT}
          urlState={{ sourceId: "sample-nuscenes" }}
        >
          <LabeledAppBar label="sample-nuscenes" {...actions} />
        </MockMessagePipelineProvider>
        {[
          "mcap-local-file",
          "ros1-local-bagfile",
          "ros2-local-bagfile",
          "ulog-local-file",
          "remote-file",
        ].map((sourceId) => (
          <MockMessagePipelineProvider
            key={sourceId}
            name="longexampleurlwith_specialcharaters-and-portnumber.ext"
            presence={PlayerPresence.PRESENT}
            urlState={{ sourceId }}
          >
            <LabeledAppBar label={sourceId} {...actions} />
          </MockMessagePipelineProvider>
        ))}
        {[
          "ros1-socket",
          "ros2-socket",
          "rosbridge-websocket",
          "foxglove-websocket",
          "velodyne-device",
          "some other source type",
        ].map((sourceId) => (
          <MockMessagePipelineProvider
            key={sourceId}
            name="https://longexampleurlwith_specialcharaters-and-portnumber:3030"
            presence={PlayerPresence.PRESENT}
            urlState={{ sourceId }}
          >
            <LabeledAppBar label={sourceId} {...actions} />
          </MockMessagePipelineProvider>
        ))}
        <MockMessagePipelineProvider
          name="https://longexampleurlwith_error-and-portnumber:3030"
          presence={PlayerPresence.PRESENT}
          problems={[
            { severity: "error", message: "example error" },
            { severity: "warn", message: "example warn" },
          ]}
        >
          <LabeledAppBar label="with problems" {...actions} />
        </MockMessagePipelineProvider>
      </div>
    </Stack>
  );
}
DataSources.parameters = { colorScheme: "light" };
