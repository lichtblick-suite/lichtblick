// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useEffect, useState } from "react";
import { useAsync } from "react-use";

import PanelSetup, { Fixture } from "@foxglove/studio-base/stories/PanelSetup";
import delay from "@foxglove/studio-base/util/delay";

import TopicGraph, { TopicVisibility } from "./index";

export default {
  title: "panels/TopicGraph",
  component: TopicGraph,
};

export const Empty = (): JSX.Element => {
  return (
    <PanelSetup>
      <TopicGraph />
    </PanelSetup>
  );
};

function TopicsStory({
  topicVisibility: initialTopicVisibility,
}: {
  topicVisibility: TopicVisibility;
}) {
  const [fixture] = useState<Fixture>({
    frame: {},
    topics: [{ name: "/topic", datatype: "std_msgs/Header" }],
    activeData: {
      publishedTopics: new Map([
        ["/topic", new Set(["pub-1", "pub-2"])],
        ["/topic_without_subscriber", new Set(["pub-1", "pub-2"])],
      ]),
      subscribedTopics: new Map([["/topic", new Set(["sub-1"])]]),
    },
  });

  useAsync(async () => {
    await delay(10);
    document.querySelector<HTMLElement>(`[data-testid="set-topic-visibility"] button`)!.click();
    const radioOption = document.querySelector<HTMLElement>(
      `[data-testid="${initialTopicVisibility}"]`,
    );
    if (radioOption) {
      radioOption.click();
      document
        .querySelector<HTMLElement>(`[data-testid="set-topic-visibility"] div button:last-child`)!
        .click();
    }
  }, [initialTopicVisibility]);

  return (
    <PanelSetup fixture={fixture}>
      <TopicGraph />
    </PanelSetup>
  );
}

export const AllTopics = (): JSX.Element => <TopicsStory topicVisibility="all" />;
export const TopicsWithSubscribers = (): JSX.Element => (
  <TopicsStory topicVisibility="subscribed" />
);
export const TopicsHidden = (): JSX.Element => <TopicsStory topicVisibility="none" />;

// Adding new active data should cause the graph to re-layout
export const ReLayout = (): JSX.Element => {
  const [fixture, setFixture] = useState<Fixture>({
    frame: {},
    topics: [{ name: "/topic", datatype: "std_msgs/Header" }],
    activeData: {
      publishedTopics: new Map([["/topic", new Set(["pub-1", "pub-2"])]]),
      subscribedTopics: new Map([["/topic", new Set(["sub-1"])]]),
    },
  });

  useEffect(() => {
    setTimeout(() => {
      setFixture({
        frame: {},
        topics: [{ name: "/topic", datatype: "std_msgs/Header" }],
        activeData: {
          publishedTopics: new Map([["/topic", new Set(["pub-1", "pub-2"])]]),
          subscribedTopics: new Map([["/topic", new Set(["sub-1", "sub-2"])]]),
        },
      });
    }, 100);
  }, []);

  return (
    <PanelSetup fixture={fixture}>
      <TopicGraph />
    </PanelSetup>
  );
};

ReLayout.parameters = {
  chromatic: {
    delay: 200,
  },
};
