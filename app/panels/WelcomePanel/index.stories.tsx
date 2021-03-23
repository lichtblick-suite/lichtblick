// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { action } from "@storybook/addon-actions";
import { useEffect, useRef, useState } from "react";
import ReactTestUtils from "react-dom/test-utils";

import AppConfigurationContext, {
  AppConfiguration,
} from "@foxglove-studio/app/context/AppConfigurationContext";
import WelcomePanel from "@foxglove-studio/app/panels/WelcomePanel";
import signal from "@foxglove-studio/app/shared/signal";
import PanelSetup from "@foxglove-studio/app/stories/PanelSetup";

export default {
  title: "<WelcomePanel>",
  component: WelcomePanel,
};

function makeConfiguration(entries?: [string, unknown][]): AppConfiguration {
  const map = new Map<string, unknown>(entries);
  return {
    get: async (key: string) => map.get(key),
    set: async (key: string, value: unknown) => void map.set(key, value),
  };
}

export function Default(): React.ReactElement {
  const [config] = useState(() => makeConfiguration());
  return (
    <AppConfigurationContext.Provider value={config}>
      <PanelSetup>
        <WelcomePanel />
      </PanelSetup>
    </AppConfigurationContext.Provider>
  );
}

export function AlreadySignedUp(): React.ReactElement {
  const [config] = useState(() => makeConfiguration([["onboarding.subscribed", true]]));
  return (
    <AppConfigurationContext.Provider value={config}>
      <PanelSetup>
        <WelcomePanel />
      </PanelSetup>
    </AppConfigurationContext.Provider>
  );
}

export function LoadingGet(): React.ReactElement {
  const [config] = useState(() => ({ get: () => signal(), set: () => signal() }));
  return (
    <AppConfigurationContext.Provider value={config}>
      <PanelSetup>
        <WelcomePanel />
      </PanelSetup>
    </AppConfigurationContext.Provider>
  );
}

function Example({ mockSetConfig }: { mockSetConfig?: () => Promise<void> }): React.ReactElement {
  const [config] = useState(() => {
    const configuration = makeConfiguration();
    if (mockSetConfig) {
      configuration.set = mockSetConfig;
    }
    return configuration;
  });
  const wrapper = useRef<HTMLDivElement>(ReactNull);
  useEffect(() => {
    const input = wrapper.current?.querySelector("input");
    const button = wrapper.current?.querySelector("[data-test='welcome-content'] button");
    const inviteCheckbox = wrapper.current?.querySelector("[data-test='slack-invite']");
    if (!input || !button || !inviteCheckbox) {
      throw new Error("missing required elements");
    }

    // Uncheck invite to slack so submitting doesn't open a new window
    ReactTestUtils.Simulate.click(inviteCheckbox);

    input.value = "test@example.com";
    ReactTestUtils.Simulate.change(input);
    setTimeout(() => {
      ReactTestUtils.Simulate.click(button);
    });
  }, []);
  return (
    <div style={{ flex: "1 1 auto" }} ref={wrapper}>
      <AppConfigurationContext.Provider value={config}>
        <PanelSetup>
          <WelcomePanel />
        </PanelSetup>
      </AppConfigurationContext.Provider>
    </div>
  );
}

export const LoadingSet = (): React.ReactElement => <Example mockSetConfig={() => signal()} />;
LoadingSet.parameters = { mockSubscribeToNewsletter: action("subscribeToNewsletter") };

export const SetFailed = (): React.ReactElement => (
  <Example mockSetConfig={() => Promise.reject("Example set error")} />
);
SetFailed.parameters = { mockSubscribeToNewsletter: action("subscribeToNewsletter") };

export const SubscribeFailed = (): React.ReactElement => <Example />;
SubscribeFailed.parameters = {
  mockSubscribeToNewsletter: () => Promise.reject("Example subscribe error"),
};

export const Success = (): React.ReactElement => <Example />;
Success.parameters = { mockSubscribeToNewsletter: () => Promise.resolve() };
