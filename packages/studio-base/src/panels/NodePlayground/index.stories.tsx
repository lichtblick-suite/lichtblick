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

import SchemaEditor from "@foxglove/studio-base/components/PanelSettings/SchemaEditor";
import NodePlayground, { Explorer } from "@foxglove/studio-base/panels/NodePlayground";
import Sidebar from "@foxglove/studio-base/panels/NodePlayground/Sidebar";
import testDocs from "@foxglove/studio-base/panels/NodePlayground/index.test.md";
import rawUserUtils from "@foxglove/studio-base/players/UserNodePlayer/nodeTransformerWorker/typescript/rawUserUtils";
import { UserNodeLog } from "@foxglove/studio-base/players/UserNodePlayer/types";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";
import { SExpectedResult } from "@foxglove/studio-base/stories/storyHelpers";
import { DEFAULT_STUDIO_NODE_PREFIX } from "@foxglove/studio-base/util/globalConstants";

const userNodes = {
  nodeId1: { name: "/studio_node/node", sourceCode: "const someVariableName = 1;" },
  nodeId2: { name: "/studio_node/node2", sourceCode: "const anotherVariableName = 2;" },
};

const userNodeRosLib = `
  export declare interface TopicsToMessageDefinition {
    "/my_topic": Messages.std_msgs__ColorRGBA;
  }

  export declare interface Duration {
    sec: number;
    nsec: number;
  }

  export declare interface Time {
    sec: number;
    nsec: number;
  }

  export declare namespace Messages {
    export interface std_msgs__ColorRGBA {
      r: number;
      g: number;
      b: number;
      a: number;
    }
  }

  export declare interface Input<T extends keyof TopicsToMessageDefinition> {
    topic: T;
    receiveTime: Time;
    message: TopicsToMessageDefinition[T];
  }
`;

const fixture = {
  topics: [],
  frame: {},
  userNodeRosLib,
};

const sourceCodeWithLogs = `
  import { Messages } from "ros";

  export const inputs = ["/my_topic"];
  export const output = "${DEFAULT_STUDIO_NODE_PREFIX}";

  const publisher = (): Messages.std_msgs__ColorRGBA => {
    log({ "someKey": { "nestedKey": "nestedValue" } });
    return { r: 1, b: 1, g: 1, a: 1 };
  };

  log(100, false, "abc", null, undefined);
  export default publisher;
`;
const logs: UserNodeLog[] = [
  { source: "registerNode", value: 100 },
  { source: "registerNode", value: false },
  { source: "registerNode", value: "abc" },
  { source: "registerNode", value: null }, // eslint-disable-line no-restricted-syntax
  { source: "registerNode", value: undefined },
  {
    source: "processMessage",
    value: { someKey: { nestedKey: "nestedValue" } },
  },
];

const sourceCodeWithUtils = `
  import { Input } from "ros";
  import { norm } from "./pointClouds";

  export const inputs = ["/my_topic"];
  export const output = "${DEFAULT_STUDIO_NODE_PREFIX}/1";

  const publisher = (message: Input<"/my_topic">): { val: number } => {
    const val = norm({x:1, y:2, z:3});
    return { val };
  };

  export default publisher;
`;

const utilsSourceCode = `
  import { type RGBA } from "ros";

  export function norm() {
    return 0;
  }
`;

const OPEN_BOTTOM_BAR_TIMEOUT = 500;
const SIDEBAR_OPEN_CLICK_TIMEOUT = 500;

storiesOf("panels/NodePlayground", module)
  .addParameters({
    chromatic: {
      delay: 2500,
    },
  })
  .add("welcome screen", () => {
    return (
      <PanelSetup fixture={fixture}>
        <NodePlayground />
      </PanelSetup>
    );
  })
  .add("rawUserUtils", () => {
    return (
      <div style={{ margin: 12 }}>
        <p style={{ color: "lightgreen" }}>
          This should be original TypeScript source code. This is a story rather than a unit test
          because it’s effectively a test of our webpack config.
        </p>
        <pre>{rawUserUtils[0]?.sourceCode}</pre>;
      </div>
    );
  })
  .add("utils usage in node", () => (
    <PanelSetup
      fixture={{
        ...fixture,
        userNodes: {
          nodeId1: {
            name: "/studio_node/node",
            sourceCode: sourceCodeWithUtils,
          },
        },
        userNodeDiagnostics: { nodeId1: [] },
        userNodeLogs: { nodeId1: [] },
      }}
    >
      <NodePlayground overrideConfig={{ selectedNodeId: "nodeId1" }} />
    </PanelSetup>
  ))
  .add("Editor shows new code when userNodes change", () => (
    <PanelSetup
      fixture={{
        ...fixture,
        userNodes: {
          nodeId1: {
            name: "/studio_node/node",
            sourceCode: sourceCodeWithUtils,
          },
        },
        userNodeDiagnostics: { nodeId1: [] },
        userNodeLogs: { nodeId1: [] },
      }}
      onMount={(el, actions) => {
        setTimeout(() => {
          // Change the userNodes to confirm the code in the Editor updates
          actions.setUserNodes({
            nodeId1: {
              name: "/studio_node/node",
              sourceCode: utilsSourceCode,
            },
          });
          el.querySelectorAll<HTMLElement>("[data-test=node-explorer]")[0]?.click();
        }, 500);
      }}
    >
      <NodePlayground overrideConfig={{ selectedNodeId: "nodeId1" }} />
      <SExpectedResult style={{ left: "375px", top: "150px" }}>
        Should show function norm() code
      </SExpectedResult>
    </PanelSetup>
  ))
  .add("editor goto definition", () => (
    <PanelSetup
      fixture={{
        ...fixture,
        userNodes: {
          nodeId1: {
            name: "/studio_node/node",
            sourceCode: sourceCodeWithUtils,
          },
        },
        userNodeDiagnostics: { nodeId1: [] },
        userNodeLogs: { nodeId1: [] },
      }}
    >
      <NodePlayground
        overrideConfig={{
          selectedNodeId: "nodeId1",
          additionalBackStackItems: [
            {
              filePath: "/studio_node/pointClouds",
              code: utilsSourceCode,
              readOnly: true,
            },
          ],
        }}
      />
    </PanelSetup>
  ))
  .add("go back from goto definition", () => (
    <PanelSetup
      fixture={{
        ...fixture,
        userNodes: {
          nodeId1: {
            name: "/studio_node/node",
            sourceCode: sourceCodeWithUtils,
          },
        },
        userNodeDiagnostics: { nodeId1: [] },
        userNodeLogs: { nodeId1: [] },
      }}
      onMount={(el) => {
        setTimeout(() => {
          el.querySelectorAll<HTMLElement>("[data-test=go-back]")[0]!.click();
        }, 500);
      }}
    >
      <NodePlayground
        overrideConfig={{
          selectedNodeId: "nodeId1",
          additionalBackStackItems: [
            {
              filePath: "/studio_node/pointClouds",
              code: utilsSourceCode,
              readOnly: true,
            },
          ],
        }}
      />
    </PanelSetup>
  ))
  .add("sidebar open - node explorer", () => {
    return (
      <PanelSetup
        fixture={{ ...fixture, userNodes }}
        onMount={(el) => {
          setTimeout(() => {
            el.querySelectorAll<HTMLElement>("[data-test=node-explorer]")[0]!.click();
          }, SIDEBAR_OPEN_CLICK_TIMEOUT);
        }}
      >
        <NodePlayground />
      </PanelSetup>
    );
  })
  .add("sidebar open - node explorer - selected node", () => {
    return (
      <PanelSetup
        fixture={{ ...fixture, userNodes }}
        onMount={(el) => {
          setTimeout(() => {
            el.querySelectorAll<HTMLElement>("[data-test=node-explorer]")[0]!.click();
          }, SIDEBAR_OPEN_CLICK_TIMEOUT);
        }}
      >
        <NodePlayground overrideConfig={{ selectedNodeId: "nodeId1" }} />
      </PanelSetup>
    );
  })
  .add("sidebar open - docs explorer", () => {
    return (
      <PanelSetup
        fixture={{ ...fixture, userNodes }}
        onMount={(el) => {
          setTimeout(() => {
            el.querySelectorAll<HTMLElement>("[data-test=docs-explorer]")[0]!.click();
          }, SIDEBAR_OPEN_CLICK_TIMEOUT);
        }}
      >
        <NodePlayground overrideConfig={{ selectedNodeId: "nodeId1" }} />
      </PanelSetup>
    );
  })
  .add("sidebar open - utils explorer - selected utility", () => {
    return (
      <PanelSetup
        fixture={{ ...fixture, userNodes }}
        onMount={(el) => {
          setTimeout(() => {
            el.querySelectorAll<HTMLElement>("[data-test=utils-explorer]")[0]!.click();
          }, SIDEBAR_OPEN_CLICK_TIMEOUT);
        }}
      >
        <NodePlayground overrideConfig={{ selectedNodeId: "nodeId1" }} />
      </PanelSetup>
    );
  })
  .add("sidebar open - templates explorer", () => {
    return (
      <PanelSetup
        fixture={{ ...fixture, userNodes }}
        onMount={(el) => {
          setTimeout(() => {
            el.querySelectorAll<HTMLElement>("[data-test=templates-explorer]")[0]!.click();
          }, SIDEBAR_OPEN_CLICK_TIMEOUT);
        }}
      >
        <NodePlayground />
      </PanelSetup>
    );
  })
  .add("sidebar - code snippets wrap", () => {
    const Story = () => {
      const [explorer, updateExplorer] = React.useState<Explorer>("docs");
      return (
        <PanelSetup fixture={{ ...fixture, userNodes }}>
          <Sidebar
            explorer={explorer}
            updateExplorer={updateExplorer}
            selectedNodeId={undefined}
            userNodes={userNodes}
            deleteNode={() => {
              // no-op
            }}
            selectNode={() => {
              // no-op
            }}
            otherMarkdownDocsForTest={testDocs}
            setScriptOverride={() => {
              // no-op
            }}
            addNewNode={() => {
              // no-op
            }}
          />
        </PanelSetup>
      );
    };
    return <Story />;
  })
  .add("editor loading state", () => {
    const NeverLoad = () => {
      throw new Promise(() => {
        // no-op
      });
    };
    return (
      <PanelSetup fixture={{ ...fixture, userNodes }}>
        <NodePlayground
          overrideConfig={{ selectedNodeId: "nodeId1", editorForStorybook: <NeverLoad /> }}
        />
      </PanelSetup>
    );
  })
  .add("BottomBar - no errors or logs - closed", () => (
    <PanelSetup
      fixture={{
        ...fixture,
        userNodes: { nodeId1: { name: "/studio_node/node", sourceCode: "" } },
        userNodeDiagnostics: { nodeId1: [] },
      }}
    >
      <NodePlayground overrideConfig={{ selectedNodeId: "nodeId1" }} />
    </PanelSetup>
  ))
  .add("BottomBar - no errors - open", () => (
    <PanelSetup
      fixture={{
        ...fixture,
        userNodes: { nodeId1: { name: "/studio_node/node", sourceCode: "" } },
        userNodeDiagnostics: { nodeId1: [] },
      }}
      onMount={(el) => {
        setTimeout(() => {
          const diagnosticsErrorsLabel = el.querySelector<HTMLElement>("[data-test=np-errors]");
          if (diagnosticsErrorsLabel) {
            diagnosticsErrorsLabel.click();
          }
        }, OPEN_BOTTOM_BAR_TIMEOUT);
      }}
    >
      <NodePlayground overrideConfig={{ selectedNodeId: "nodeId1" }} />
    </PanelSetup>
  ))
  .add("BottomBar - no logs - open", () => (
    <PanelSetup
      fixture={{
        ...fixture,
        userNodes: { nodeId1: { name: "/studio_node/node", sourceCode: "" } },
        userNodeDiagnostics: { nodeId1: [] },
      }}
      onMount={(el) => {
        setTimeout(() => {
          const logsLabel = el.querySelector<HTMLElement>("[data-test=np-logs]");
          if (logsLabel) {
            logsLabel.click();
          }
        }, OPEN_BOTTOM_BAR_TIMEOUT);
      }}
    >
      <NodePlayground overrideConfig={{ selectedNodeId: "nodeId1" }} />
    </PanelSetup>
  ))
  .add("BottomBar - errors - closed", () => (
    <PanelSetup
      fixture={{
        ...fixture,
        userNodes: { nodeId1: { name: "/studio_node/node", sourceCode: "" } },
        userNodeDiagnostics: {
          nodeId1: [
            {
              message: `Type '"bad number"' is not assignable to type 'number[]'.`,
              severity: 8,
              source: "Typescript",
              startLineNumber: 0,
              startColumn: 6,
              endLineNumber: 72,
              endColumn: 20,
              code: 2304,
            },
            {
              message: "This is a warning message (without line or column numbers).",
              severity: 4,
              source: "Source A",
              endLineNumber: 72,
              endColumn: 20,
              code: 2304,
            },
            {
              message: "This is an info message (without line or column numbers).",
              severity: 2,
              source: "Source B",
              code: 2304,
            },
            {
              message: "This is a hint message (without line or column numbers).",
              severity: 1,
              source: "Source C",
              code: 2304,
            },
          ],
        },
      }}
    >
      <NodePlayground overrideConfig={{ selectedNodeId: "nodeId1" }} />
    </PanelSetup>
  ))
  .add("BottomBar - errors - open", () => (
    <PanelSetup
      fixture={{
        ...fixture,
        userNodes: { nodeId1: { name: "/studio_node/node", sourceCode: "" } },
        userNodeDiagnostics: {
          nodeId1: [
            {
              message: `Type '"bad number"' is not assignable to type 'number[]'.`,
              severity: 8,
              source: "Typescript",
              startLineNumber: 0,
              startColumn: 6,
              endLineNumber: 72,
              endColumn: 20,
              code: 2304,
            },
            {
              message: "This is a warning message (without line or column numbers).",
              severity: 4,
              source: "Source A",
              endLineNumber: 72,
              endColumn: 20,
              code: 2304,
            },
            {
              message: "This is an info message (without line or column numbers).",
              severity: 2,
              source: "Source B",
              code: 2304,
            },
            {
              message: "This is a hint message (without line or column numbers).",
              severity: 1,
              source: "Source C",
              code: 2304,
            },
          ],
        },
      }}
      onMount={(el) => {
        setTimeout(() => {
          const diagnosticsErrorsLabel = el.querySelector<HTMLElement>("[data-test=np-errors]");
          if (diagnosticsErrorsLabel) {
            diagnosticsErrorsLabel.click();
          }
        }, OPEN_BOTTOM_BAR_TIMEOUT);
      }}
    >
      <NodePlayground overrideConfig={{ selectedNodeId: "nodeId1" }} />
    </PanelSetup>
  ))
  .add("BottomBar - logs - closed", () => (
    <PanelSetup
      fixture={{
        ...fixture,
        userNodes: {
          nodeId1: {
            name: "/studio_node/node",
            sourceCode: sourceCodeWithLogs,
          },
        },
        userNodeDiagnostics: { nodeId1: [] },
        userNodeLogs: { nodeId1: logs },
      }}
    >
      <NodePlayground overrideConfig={{ selectedNodeId: "nodeId1" }} />
    </PanelSetup>
  ))
  .add("BottomBar - logs - open", () => (
    <PanelSetup
      fixture={{
        ...fixture,
        userNodes: {
          nodeId1: {
            name: "/studio_node/node",
            sourceCode: sourceCodeWithLogs,
          },
        },
        userNodeDiagnostics: { nodeId1: [] },
        userNodeLogs: { nodeId1: logs },
      }}
      onMount={(el) => {
        setTimeout(() => {
          const logsLabel = el.querySelector<HTMLElement>("[data-test=np-logs]");
          if (logsLabel) {
            logsLabel.click();
          }
        }, OPEN_BOTTOM_BAR_TIMEOUT);
      }}
    >
      <NodePlayground overrideConfig={{ selectedNodeId: "nodeId1" }} />
    </PanelSetup>
  ))
  .add("BottomBar - cleared logs", () => (
    <PanelSetup
      fixture={{
        ...fixture,
        userNodes: { nodeId1: { name: "/studio_node/node", sourceCode: "" } },
        userNodeDiagnostics: { nodeId1: [] },
        userNodeLogs: { nodeId1: logs },
      }}
      onFirstMount={(el) => {
        setTimeout(() => {
          const logsLabel = el.querySelector<HTMLElement>("[data-test=np-logs]");
          if (logsLabel) {
            logsLabel.click();
            const clearBtn = el.querySelector<HTMLElement>("button[data-test=np-logs-clear]");
            if (clearBtn) {
              clearBtn.click();
            }
          }
        }, OPEN_BOTTOM_BAR_TIMEOUT);
      }}
    >
      <NodePlayground overrideConfig={{ selectedNodeId: "nodeId1" }} />
    </PanelSetup>
  ))
  .add("Settings", () => {
    return (
      <SchemaEditor
        configSchema={NodePlayground.configSchema!}
        config={NodePlayground.defaultConfig}
        saveConfig={() => {}}
      />
    );
  });
