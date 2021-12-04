// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { action } from "@storybook/addon-actions";
import { useCallback, useRef, useState } from "react";
import ReactTestUtils from "react-dom/test-utils";

import AppConfigurationContext from "@foxglove/studio-base/context/AppConfigurationContext";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";
import delay from "@foxglove/studio-base/util/delay";
import { makeConfiguration } from "@foxglove/studio-base/util/makeConfiguration";
import signal from "@foxglove/studio-base/util/signal";

import SubscribeContext, { SubscribeNewsletterFn } from "./SubscribeContext";
import WelcomePanel from "./index";

export default {
  title: "panels/WelcomePanel",
  component: WelcomePanel,
};

export function Default(): React.ReactElement {
  const [config] = useState(() => makeConfiguration());
  return (
    <PanelSetup>
      <AppConfigurationContext.Provider value={config}>
        <WelcomePanel />
      </AppConfigurationContext.Provider>
    </PanelSetup>
  );
}

export function AlreadySignedUp(): React.ReactElement {
  const [config] = useState(() => makeConfiguration([["onboarding.subscribed", true]]));
  return (
    <PanelSetup>
      <AppConfigurationContext.Provider value={config}>
        <WelcomePanel />
      </AppConfigurationContext.Provider>
    </PanelSetup>
  );
}

type ExampleProps = {
  mockSetConfig?: () => Promise<void>;
  mockSubscribe?: SubscribeNewsletterFn;
};

function Example({
  mockSetConfig,
  mockSubscribe = async () => undefined,
}: ExampleProps): React.ReactElement {
  const [config] = useState(() => {
    const configuration = makeConfiguration();
    if (mockSetConfig) {
      configuration.set = mockSetConfig;
    }
    return configuration;
  });
  const wrapper = useRef<HTMLDivElement>(ReactNull);
  const onMount = useCallback(async () => {
    for (let tries = 0; tries < 5; tries++) {
      const input = wrapper.current?.querySelector("input");
      const button = wrapper.current?.querySelector("[data-test='welcome-content'] button");
      if (!input || !button) {
        await delay(100);
        continue;
      }

      input.value = "test@example.com";
      ReactTestUtils.Simulate.change(input);
      await delay(0);
      ReactTestUtils.Simulate.click(button);
      return;
    }
    throw new Error("missing required elements");
  }, []);
  return (
    <div style={{ flex: "1 1 auto" }} ref={wrapper}>
      <PanelSetup onMount={onMount}>
        <AppConfigurationContext.Provider value={config}>
          <SubscribeContext.Provider value={mockSubscribe}>
            <WelcomePanel />
          </SubscribeContext.Provider>
        </AppConfigurationContext.Provider>
      </PanelSetup>
    </div>
  );
}

export const LoadingSet = (): React.ReactElement => (
  <Example mockSetConfig={() => signal()} mockSubscribe={action("subscribeToNewsletter")} />
);

export const SetFailed = (): React.ReactElement => (
  <Example
    mockSetConfig={async () => {
      throw "Example set error";
    }}
    mockSubscribe={action("subscribeToNewsletter")}
  />
);

export const SubscribeFailed = (): React.ReactElement => (
  <Example
    mockSubscribe={async () => {
      throw "Example subscribe error";
    }}
  />
);

export const Success = (): React.ReactElement => <Example mockSubscribe={async () => undefined} />;
