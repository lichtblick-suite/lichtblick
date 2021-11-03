// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { action } from "@storybook/addon-actions";

import { UnsavedChangesPrompt } from "@foxglove/studio-base/components/LayoutBrowser/UnsavedChangesPrompt";
import { defaultPlaybackConfig } from "@foxglove/studio-base/providers/CurrentLayoutProvider/reducers";
import { Layout, LayoutID, ISO8601Timestamp } from "@foxglove/studio-base/services/ILayoutStorage";

export default {
  title: "components/LayoutBrowser/UnsavedChangesPrompt",
  component: UnsavedChangesPrompt,
  parameters: { colorScheme: "dark" },
};

const dummyLayout: Layout = {
  id: "dummy-id" as LayoutID,
  name: "Example layout",
  permission: "ORG_WRITE",
  baseline: {
    savedAt: new Date(10).toISOString() as ISO8601Timestamp,
    data: {
      configById: {},
      globalVariables: {},
      userNodes: {},
      linkedGlobalVariables: [],
      playbackConfig: defaultPlaybackConfig,
    },
  },
  working: undefined,
  syncInfo: undefined,
};

export function Default(): JSX.Element {
  return <UnsavedChangesPrompt isOnline layout={dummyLayout} onComplete={action("onComplete")} />;
}
export const DefaultLight = Object.assign(Default.bind(undefined), {
  parameters: { colorScheme: "light" },
});

export function Offline(): JSX.Element {
  return (
    <UnsavedChangesPrompt isOnline={false} layout={dummyLayout} onComplete={action("onComplete")} />
  );
}

export function Overwrite(): JSX.Element {
  return (
    <UnsavedChangesPrompt
      isOnline
      layout={dummyLayout}
      onComplete={action("onComplete")}
      defaultSelectedKey="overwrite"
    />
  );
}

export function MakePersonal(): JSX.Element {
  return (
    <UnsavedChangesPrompt
      isOnline
      layout={dummyLayout}
      onComplete={action("onComplete")}
      defaultSelectedKey="makePersonal"
    />
  );
}

export function MakePersonalWithEmptyField(): JSX.Element {
  return (
    <UnsavedChangesPrompt
      isOnline
      layout={dummyLayout}
      onComplete={action("onComplete")}
      defaultSelectedKey="makePersonal"
      defaultPersonalCopyName=""
    />
  );
}
