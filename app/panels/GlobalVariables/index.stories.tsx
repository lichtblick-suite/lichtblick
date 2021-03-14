// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { storiesOf } from "@storybook/react";

import GlobalVariables from "./index";
import { LinkedGlobalVariable } from "@foxglove-studio/app/panels/ThreeDimensionalViz/Interactions/useLinkedGlobalVariables";
import delay from "@foxglove-studio/app/shared/delay";
import PanelSetup, { triggerInputChange } from "@foxglove-studio/app/stories/PanelSetup";

const exampleVariables = {
  someNum: 0,
  someText: "active",
  someObj: { age: 50 },
  someArrOfNums: [1, 2, 3],
  someArrOfText: ["a", "b", "c"],
};
const exampleDataWithLinkedVariables = {
  ...exampleVariables,
  linkedName: "some_name",
  linkedScaleObject: { x: 1, y: 1, z: 1 },
  linkedId: 100,
};

const linkedGlobalVariables = [
  {
    topic: "/other_topic_1",
    markerKeyPath: ["name"],
    name: "linkedName",
  },
  {
    topic: "/some_topic",
    markerKeyPath: ["scale", "some_very_very_long_path"],
    name: "linkedScaleObject",
  },
  {
    topic: "/foo/bar",
    markerKeyPath: ["main_id"],
    name: "linkedId",
  },
  {
    topic: "/foo/bar",
    markerKeyPath: ["other_id"],
    name: "linkedId",
  },
];

function PanelWithData({
  linkedGlobalVariables: linkedGlobalVars = [],
  ...rest
}: {
  linkedGlobalVariables?: LinkedGlobalVariable[];
  onMount?: any;
}) {
  const globalVariables = linkedGlobalVars.length
    ? exampleDataWithLinkedVariables
    : exampleVariables;
  const fixture = {
    topics: [],
    frame: {},
    linkedGlobalVariables: linkedGlobalVars,
    globalVariables,
  };

  return (
    <PanelSetup fixture={fixture} {...rest}>
      <GlobalVariables />
    </PanelSetup>
  );
}

const DEFAULT_DELAY = 100;

storiesOf("<GlobalVariables>", module)
  .add("default", () => {
    return <PanelWithData />;
  })
  .add("with linked variables", () => {
    return <PanelWithData linkedGlobalVariables={linkedGlobalVariables} />;
  })
  .addParameters({
    screenshot: {
      delay: 1000,
    },
  })
  .add("click 'Add variable' button", () => {
    return (
      <PanelWithData
        onMount={async (el: any) => {
          await delay(DEFAULT_DELAY);
          const addBtn = el.querySelector("[data-test='add-variable-btn']");
          if (addBtn) {
            addBtn.click();
          }
        }}
      />
    );
  })
  .add("error state: empty variable name", () => {
    return (
      <PanelWithData
        onMount={async (el: any) => {
          await delay(DEFAULT_DELAY);
          const addBtn = el.querySelector("[data-test='add-variable-btn']");
          if (addBtn) {
            addBtn.click();
            await delay(DEFAULT_DELAY);
            const firstKeyInput = document.querySelector(
              "[data-test='global-variable-key'] input",
            ) as HTMLInputElement;
            if (firstKeyInput) {
              triggerInputChange(firstKeyInput, "");
            }
          }
        }}
      />
    );
  })
  .add("error state: variable name collision", () => {
    return (
      <PanelWithData
        onMount={async (el: any) => {
          await delay(DEFAULT_DELAY);
          const addBtn = el.querySelector("[data-test='add-variable-btn']");
          if (addBtn) {
            addBtn.click();
            await delay(DEFAULT_DELAY);
            const firstKeyInput = document.querySelector(
              "[data-test='global-variable-key'] input",
            ) as HTMLInputElement;
            if (firstKeyInput) {
              triggerInputChange(firstKeyInput, "$someText");
            }
          }
        }}
      />
    );
  })
  .add("edit linked variable value", () => {
    return (
      <PanelWithData
        linkedGlobalVariables={linkedGlobalVariables}
        onMount={async () => {
          await delay(DEFAULT_DELAY);
          const allJsonInput = document.querySelectorAll("[data-test='json-input']") as any;
          const linkedVarJsonInput = allJsonInput[2];
          if (linkedVarJsonInput) {
            triggerInputChange(linkedVarJsonInput, "value is not 100 any more");
          }
        }}
      />
    );
  })
  .add("unlink a variable with a single link", () => {
    return (
      <PanelWithData
        linkedGlobalVariables={linkedGlobalVariables}
        onMount={async (el: any) => {
          await delay(DEFAULT_DELAY);
          const btn = el.querySelector("[data-test='unlink-linkedName']");
          if (btn) {
            btn.click();
            await delay(DEFAULT_DELAY);
            const pathBtn = document.querySelector("[data-test='unlink-path']");
            if (pathBtn) {
              (pathBtn as any).click();
            }
          }
        }}
      />
    );
  })
  .add("unlink a variable with multiple links", () => {
    return (
      <PanelWithData
        linkedGlobalVariables={linkedGlobalVariables}
        onMount={async (el: any) => {
          await delay(DEFAULT_DELAY);
          const btn = el.querySelector("[data-test='unlink-linkedId']");
          if (btn) {
            btn.click();
            await delay(DEFAULT_DELAY);
            const pathBtn = document.querySelector("[data-test='unlink-path']");
            if (pathBtn) {
              (pathBtn as any).click();
            }
          }
        }}
      />
    );
  });
