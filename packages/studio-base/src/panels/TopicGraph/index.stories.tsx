// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useEffect, useState } from "react";

import PanelSetup, { Fixture } from "@foxglove/studio-base/stories/PanelSetup";

import TopicGraph from "./index";

export default {
  title: "panels/TopicGraph/index",
  component: TopicGraph,
};

export const Empty = (): JSX.Element => {
  return (
    <PanelSetup>
      <TopicGraph />
    </PanelSetup>
  );
};

export const OneTopic = (): JSX.Element => {
  const [fixture] = useState<Fixture>({
    frame: {},
    topics: [{ name: "/topic", datatype: "std_msgs/Header" }],
    activeData: {
      publishedTopics: new Map(
        Object.entries({
          "/topic": new Set(["pub-1", "pub-2"]),
        }),
      ),
      subscribedTopics: new Map(
        Object.entries({
          "/topic": new Set(["sub-1"]),
        }),
      ),
    },
  });

  return (
    <PanelSetup fixture={fixture}>
      <TopicGraph />
    </PanelSetup>
  );
};

// Adding new active data should cause the graph to re-layout
export const ReLayout = (): JSX.Element => {
  const [fixture, setFixture] = useState<Fixture>({
    frame: {},
    topics: [{ name: "/topic", datatype: "std_msgs/Header" }],
    activeData: {
      publishedTopics: new Map(
        Object.entries({
          "/topic": new Set(["pub-1", "pub-2"]),
        }),
      ),
      subscribedTopics: new Map(
        Object.entries({
          "/topic": new Set(["sub-1"]),
        }),
      ),
    },
  });

  useEffect(() => {
    setTimeout(() => {
      setFixture({
        frame: {},
        topics: [{ name: "/topic", datatype: "std_msgs/Header" }],
        activeData: {
          publishedTopics: new Map(
            Object.entries({
              "/topic": new Set(["pub-1", "pub-2"]),
            }),
          ),
          subscribedTopics: new Map(
            Object.entries({
              "/topic": new Set(["sub-1", "sub-2"]),
            }),
          ),
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
