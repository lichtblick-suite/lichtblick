// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.
import { storiesOf } from "@storybook/react";

import TopicToRenderMenu from "@foxglove/studio-base/components/TopicToRenderMenu";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";

const topics = [
  {
    name: "/foo",
    datatype: "abc_msgs/foo",
  },
  {
    name: "/studio_source_2/foo",
    datatype: "abc_msgs/foo",
  },
  {
    name: "/studio_source_2/foo",
    datatype: "bad_datatype/abc_msgs/foo",
  },
];

const topicsGroups = [
  {
    key: "foo",
    suffix: "/foo",
    datatype: "abc_msgs/foo",
  },
  {
    key: "bar",
    suffix: "/bar",
    datatype: "abc_msgs/bar",
  },
];

storiesOf("components/TopicToRenderMenu", module)
  .add("example (have topicsGroups)", () => {
    return (
      <PanelSetup
        fixture={{ topics: [], datatypes: {}, frame: {} }}
        onMount={(el: any) => {
          const topicSet = el.querySelector("[data-test=topic-set]");
          if (topicSet) {
            topicSet.click();
          }
        }}
      >
        <TopicToRenderMenu
          onChange={() => {
            // no-op
          }}
          topicToRender=""
          topics={topics}
          topicsGroups={topicsGroups}
          defaultTopicToRender=""
        />
      </PanelSetup>
    );
  })
  .add("example (have singleTopicDatatype)", () => {
    return (
      <PanelSetup
        fixture={{ topics: [], datatypes: {}, frame: {} }}
        onMount={(el: any) => {
          const topicSet = el.querySelector("[data-test=topic-set]");
          if (topicSet) {
            topicSet.click();
          }
        }}
      >
        <TopicToRenderMenu
          onChange={() => {
            // no-op
          }}
          topicToRender="/foo"
          topics={topics}
          singleTopicDatatype={"abc_msgs/foo"}
          defaultTopicToRender="/foo"
        />
      </PanelSetup>
    );
  })
  .add("select another topic (have singleTopicDatatype)", () => {
    return (
      <PanelSetup
        fixture={{ topics: [], datatypes: {}, frame: {} }}
        onMount={(el: any) => {
          const topicSet = el.querySelector("[data-test=topic-set]");
          if (topicSet) {
            topicSet.click();
          }
        }}
      >
        <TopicToRenderMenu
          onChange={() => {
            // no-op
          }}
          topicToRender="/studio_source_2/foo"
          topics={topics}
          singleTopicDatatype={"abc_msgs/foo"}
          defaultTopicToRender="/foo"
        />
      </PanelSetup>
    );
  })
  .add("no bag loaded, defaultTopicToRender === topicToRender (have topicsGroups)", () => {
    return (
      <PanelSetup
        fixture={{ topics: [], datatypes: {}, frame: {} }}
        onMount={(el: any) => {
          const topicSet = el.querySelector("[data-test=topic-set]");
          if (topicSet) {
            topicSet.click();
          }
        }}
      >
        <TopicToRenderMenu
          onChange={() => {
            // no-op
          }}
          topicToRender=""
          topics={[]}
          topicsGroups={topicsGroups}
          defaultTopicToRender=""
        />
      </PanelSetup>
    );
  })
  .add("no bag loaded, defaultTopicToRender !== topicToRender (have topicsGroups)", () => {
    return (
      <PanelSetup
        fixture={{ topics: [], datatypes: {}, frame: {} }}
        onMount={(el: any) => {
          const topicSet = el.querySelector("[data-test=topic-set]");
          if (topicSet) {
            topicSet.click();
          }
        }}
      >
        <TopicToRenderMenu
          onChange={() => {
            // no-op
          }}
          topicToRender="/studio_source_2"
          topics={[]}
          topicsGroups={topicsGroups}
          defaultTopicToRender=""
        />
      </PanelSetup>
    );
  })
  .add("bag loaded but topicToRender is not available (have singleTopicDatatype)", () => {
    return (
      <PanelSetup
        fixture={{ topics: [], datatypes: {}, frame: {} }}
        onMount={(el: any) => {
          const topicSet = el.querySelector("[data-test=topic-set]");
          if (topicSet) {
            topicSet.click();
          }
        }}
      >
        <TopicToRenderMenu
          onChange={() => {
            // no-op
          }}
          topicToRender="/abc"
          topics={topics}
          singleTopicDatatype={"abc_msgs/foo"}
          defaultTopicToRender="/foo"
        />
      </PanelSetup>
    );
  })
  .add("bag loaded but defaultTopicToRender is not available (have singleTopicDatatype)", () => {
    return (
      <PanelSetup
        fixture={{ topics: [], datatypes: {}, frame: {} }}
        onMount={(el: any) => {
          const topicSet = el.querySelector("[data-test=topic-set]");
          if (topicSet) {
            topicSet.click();
          }
        }}
      >
        <TopicToRenderMenu
          onChange={() => {
            // no-op
          }}
          topicToRender="/bar"
          topics={topics}
          singleTopicDatatype={"abc_msgs/foo"}
          defaultTopicToRender="/bar"
        />
      </PanelSetup>
    );
  });
