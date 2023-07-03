// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useTheme } from "@mui/material";
import { StoryObj } from "@storybook/react";
import { fireEvent, userEvent } from "@storybook/testing-library";
import { produce } from "immer";
import { last } from "lodash";
import { useCallback, useMemo, useState, useEffect } from "react";

import Logger from "@foxglove/log";
import {
  SettingsTreeNode,
  SettingsTreeNodes,
  SettingsTreeFieldValue,
  SettingsTreeAction,
} from "@foxglove/studio";
import { MessagePathInputStoryFixture } from "@foxglove/studio-base/components/MessagePathSyntax/fixture";
import SettingsTreeEditor from "@foxglove/studio-base/components/SettingsTreeEditor";
import Stack from "@foxglove/studio-base/components/Stack";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";

export default {
  title: "components/SettingsTreeEditor",
  component: SettingsTreeEditor,
};

const log = Logger.getLogger(__filename);

const BasicSettings: SettingsTreeNodes = {
  general: {
    label: "General",
    icon: "Settings",
    visible: true,
    error: "This topic has an error",
    renamable: true,
    actions: [
      { type: "action", id: "add-grid", label: "Add new grid", icon: "Grid" },
      { type: "action", id: "add-background", label: "Add new background", icon: "Background" },
      { type: "action", id: "toggle-value", label: "Toggle Value", icon: "Check" },
      { type: "divider" },
      { type: "action", id: "reset-values", label: "Reset values" },
    ],
    fields: {
      emptyField: undefined,
      longField: {
        input: "string",
        label: "A field with a very long label that might wrap or truncate",
      },
      numberWithPrecision: {
        input: "number",
        label: "Number with precision",
        value: 1.2345789,
        precision: 4,
      },
      gradient: { input: "gradient", label: "Gradient" },
      numberWithPlaceholder: {
        input: "number",
        label: "Number with placeholder",
        step: 10,
        placeholder: "3",
      },
      fieldWithError: {
        input: "string",
        label: "Field With Error",
        error: "This field has an error message that should be displayed to the user",
      },
    },
    children: {
      emptyChild: undefined,
    },
  },
  complex_inputs: {
    label: "Complex Inputs",
    icon: "Hive",
    visible: true,
    actions: [{ type: "action", id: "action", label: "Action" }],
    fields: {
      messagepath: {
        label: "Message Path",
        input: "messagepath",
        value: "/some_topic/state.foo_id.@abs",
        supportsMathModifiers: true,
      },
      topic: {
        label: "Topic",
        input: "autocomplete",
        items: ["topic1", "topic2", "topic3"],
      },
      vec3: {
        label: "Vec3",
        input: "vec3",
        labels: ["U", "V", "W"],
        value: [1.1111, 2.2222, 3.3333],
        precision: 2,
        step: 2,
      },
      emptySelect: {
        label: "Empty Select",
        value: undefined,
        input: "select",
        options: [
          { label: "Undefined", value: undefined },
          { label: "Nothing", value: "" },
          { label: "Something", value: "something" },
        ],
      },
    },
  },
  emptyNode: {
    label: "Empty node",
  },
  defaultCollapsed: {
    label: "Default Collapsed",
    defaultExpansionState: "collapsed",
    visible: true,
    fields: {
      field: { label: "Field", input: "string" },
    },
  },
  background: {
    label: "Background",
    icon: "Background",
    visible: true,
    fields: {
      colorRGB: { label: "Color RGB", value: "#000000", input: "rgb" },
      colorRGBA: { label: "Color RGBA", value: "rgba(0, 128, 255, 0.75)", input: "rgba" },
    },
  },
  threeDimensionalModel: {
    label: "3D Model",
    icon: "Cube",
    visible: true,
    fields: {
      color: {
        label: "Color",
        input: "rgb",
        value: "#9480ed",
      },
      url: {
        label: "Model URL (URDF)",
        input: "string",
        placeholder: "https://example.com/.../model.urdf",
        value: "",
        help: `URL pointing to a Unified Robot Description Format (URDF) XML file.
For ROS users, we also support package:// URLs
(loaded from the local filesystem) in our desktop app.`,
      },
    },
  },
  empty: undefined,
};

const SelectValidWithUndefinedSettings: SettingsTreeNodes = {
  general: {
    fields: {
      validSelectWithUndefined: {
        label: "Valid Select w/ Undefined",
        value: undefined,
        input: "select",
        options: [
          { label: "Undefined", value: undefined },
          { label: "Nothing", value: "" },
          { label: "Something", value: "something" },
        ],
      },
    },
  },
};
const SelectValidWithEmptyStringSettings: SettingsTreeNodes = {
  general: {
    fields: {
      validSelectWithEmptyString: {
        label: 'Valid Select w/ ""',
        value: "",
        input: "select",
        options: [
          { label: "Undefined", value: undefined },
          { label: "Nothing", value: "" },
          { label: "Something", value: "something" },
        ],
      },
    },
  },
};
const SelectInvalidWithUndefinedSettings: SettingsTreeNodes = {
  general: {
    fields: {
      invalidSelectWithUndefined: {
        label: "Invalid Select w/ Undefined",
        value: "foobar",
        input: "select",
        options: [
          { label: "Undefined", value: undefined },
          { label: "Nothing", value: "" },
          { label: "Something", value: "something" },
        ],
      },
    },
  },
};
const SelectInvalidWithoutUndefinedSettings: SettingsTreeNodes = {
  general: {
    fields: {
      invalidSelectWithoutUndefined: {
        label: "Invalid Select w/o Undefined",
        value: "foobar",
        input: "select",
        options: [
          { label: "Nothing", value: "" },
          { label: "Something", value: "something" },
        ],
      },
    },
  },
};
const SelectEmptySettings: SettingsTreeNodes = {
  general: {
    fields: {
      emptySelect: {
        label: "Empty Select",
        value: undefined,
        input: "select",
        options: [],
      },
    },
  },
};
const SelectEmptyInvalidSettings: SettingsTreeNodes = {
  general: {
    fields: {
      invalidEmptySelect: {
        label: "Invalid Empty Select",
        value: "foobar",
        input: "select",
        options: [],
      },
    },
  },
};

const DisabledSettings: SettingsTreeNodes = {
  general: {
    label: "Disabled Fields",
    icon: "Grid",
    fields: {
      autocomplete: {
        input: "autocomplete",
        label: "Autocomplete",
        items: ["one", "two"],
        value: "one",
        disabled: true,
      },
      boolean: {
        input: "boolean",
        label: "Boolean",
        disabled: true,
      },
      gradient: {
        input: "gradient",
        label: "Gradient",
        value: ["#ffffff", "#000000"],
        disabled: true,
      },
      messagePath: {
        input: "messagepath",
        label: "Message Path",
        disabled: true,
      },
      number: {
        input: "number",
        label: "Number",
        value: 123,
        disabled: true,
      },
      rgb: {
        input: "rgb",
        label: "RGB",
        value: "#0000ff",
        disabled: true,
      },
      rgba: {
        input: "rgba",
        label: "RGBA",
        value: "#0000ff88",
        disabled: true,
      },
      select: {
        input: "select",
        label: "Select",
        options: [
          { label: "One", value: "one" },
          { label: "Two", value: "two" },
        ],
        value: "one",
        disabled: true,
      },
      text: {
        input: "string",
        label: "Text",
        value: "text",
        disabled: true,
      },
      toggle: {
        input: "toggle",
        label: "Toggle",
        value: "one",
        options: [
          { label: "One", value: "one" },
          { label: "Two", value: "two" },
        ],
        disabled: true,
      },
      vec2: {
        input: "vec2",
        label: "Vec2",
        value: [1, 2],
        disabled: true,
      },
      vec3: {
        input: "vec3",
        label: "Vec3",
        value: [1, 2, 3],
        disabled: true,
      },
    },
    children: {},
  },
};

const ReadonlySettings: SettingsTreeNodes = {
  general: {
    label: "ReadOnly Fields",
    icon: "Grid",
    fields: {
      autocomplete: {
        input: "autocomplete",
        label: "Autocomplete",
        items: ["one", "two"],
        value: "one",
        readonly: true,
      },
      boolean: {
        input: "boolean",
        label: "Boolean",
        readonly: true,
      },
      gradient: {
        input: "gradient",
        label: "Gradient",
        value: ["#ffffff", "#000000"],
        readonly: true,
      },
      messagePath: {
        input: "messagepath",
        label: "Message Path",
        readonly: true,
      },
      number: {
        input: "number",
        label: "Number",
        value: 123,
        readonly: true,
      },
      rgb: {
        input: "rgb",
        label: "RGB",
        value: "#0000ff",
        readonly: true,
      },
      rgba: {
        input: "rgba",
        label: "RGBA",
        value: "#0000ff88",
        readonly: true,
      },
      select: {
        input: "select",
        label: "Select",
        options: [
          { label: "One", value: "one" },
          { label: "Two", value: "two" },
        ],
        value: "one",
        readonly: true,
      },
      text: {
        input: "string",
        label: "Text",
        value: "text",
        readonly: true,
      },
      toggle: {
        input: "toggle",
        label: "Toggle",
        value: "one",
        options: [
          { label: "One", value: "one" },
          { label: "Two", value: "two" },
        ],
        readonly: true,
      },
      vec2: {
        input: "vec2",
        label: "Vec2",
        value: [1, 2],
        readonly: true,
      },
      vec3: {
        input: "vec3",
        label: "Vec3",
        value: [1, 2, 3],
        readonly: true,
      },
    },
    children: {},
  },
};

const PanelExamplesSettings: SettingsTreeNodes = {
  map: {
    label: "Map",
    icon: "Map",
    renamable: true,
    order: 3,
    fields: {
      message_path: {
        label: "Message path",
        input: "string",
        value: "/gps/fix",
      },
      style: {
        label: "Map style",
        value: "Open Street Maps",
        input: "select",
        options: [
          { label: "Open Street Maps", value: "Open Street Maps" },
          {
            label: "Stadia Maps (Adelaide Smooth Light)",
            value: "Stadia Maps (Adelaide Smooth Light)",
          },
          {
            label: "Stadia Maps (Adelaide Smooth Dark)",
            value: "Stadia Maps (Adelaide Smooth Dark)",
          },
          { label: "Custom", value: "Custom" },
        ],
      },
      api_key: {
        label: "API key (optional)",
        input: "string",
      },
      color_by: {
        label: "Color by",
        value: "flat",
        input: "toggle",
        options: [
          { label: "Flat", value: "flat" },
          { label: "Point data", value: "data" },
        ],
      },
      marker_color: {
        label: "Marker color",
        input: "rgb",
        value: "#ff0000",
      },
    },
  },
  grid: {
    label: "Grid",
    icon: "Grid",
    renamable: true,
    order: 2,
    fields: {
      color: {
        label: "Color",
        value: "#248eff",
        input: "rgb",
      },
      size: {
        label: "Size",
        value: undefined,
        input: "number",
        max: 10,
        min: 1,
      },
      subdivision: {
        label: "Subdivision",
        input: "number",
        value: 9,
      },
      frame_lock: {
        label: "Frame lock",
        input: "boolean",
        value: false,
        help: "When enabled, the map will not be updated when the robot moves.",
      },
    },
  },
  pose: {
    label: "Pose",
    icon: "Walk",
    renamable: true,
    order: 1,
    fields: {
      color: { label: "Color", value: "#ffffff", input: "rgb" },
      shaft_length: { label: "Shaft length", value: 1.5, input: "number" },
      shaft_position: { label: "Shaft Position", value: [1, 2, 3], input: "vec3", min: 0, max: 5 },
    },
  },
};

const IconExamplesSettings: SettingsTreeNodes = {
  noIcon1: {
    label: "No Icon",
    fields: {
      message_path: {
        label: "Message path",
        input: "string",
        value: "/gps/fix",
      },
    },
    children: {
      child1: {
        label: "Child 1",
        fields: {
          field1: { label: "Field 1", input: "string" },
        },
      },
      child2: {
        label: "Child 2",
        icon: "Move",
        fields: {
          field1: { label: "Field 1", input: "string" },
        },
      },
    },
  },
  grid: {
    label: "Grid",
    icon: "Grid",
    error: "Also an error!",
    visible: true,
    actions: [
      { type: "action", id: "action1", label: "Action 1", display: "inline", icon: "Camera" },
      { type: "action", id: "action2", label: "Action 2", display: "inline", icon: "Clock" },
      { type: "action", id: "action3", label: "Action 3", display: "inline" },
      { type: "action", id: "action4", label: "Action 4", display: "menu" },
    ],
    fields: {
      color: {
        label: "Color",
        value: "#248eff",
        input: "rgb",
      },
    },
  },
  noIcon2: {
    label: "No Icon2",
    fields: {
      message_path: {
        label: "Message path",
        input: "string",
        value: "/gps/fix",
      },
    },
  },
  pose: {
    label: "Pose",
    icon: "Walk",
    fields: {
      color: { label: "Color", value: "#ffffff", input: "rgb" },
    },
  },
};

const TopicSettings: SettingsTreeNodes = {
  topics: {
    label: "Topics",
    icon: "Topic",
    visible: true,
    children: {
      drivable_area: {
        label: "/drivable_area",
        visible: true,
        fields: {
          frame_lock: {
            label: "Frame lock",
            input: "boolean",
            value: false,
            help: "When enabled, the map will not be updated when the robot moves.",
          },
        },
      },
      map: {
        label: "/map",
        fields: {
          frame_lock: {
            label: "Frame lock",
            input: "boolean",
            value: false,
            help: "When enabled, the map will not be updated when the robot moves.",
          },
        },
      },
      semantic_map: {
        label: "/semantic_map",
        fields: {
          color: {
            label: "Color",
            value: "#00ff00",
            input: "rgb",
          },
          click_handling: {
            label: "Selection mode",
            value: "Line",
            input: "select",
            options: [
              { value: "Line", label: "Line" },
              { value: "Enclosed polygons", label: "Enclosed polygons" },
            ],
            help: `Treating line markers as polygons. Clicking inside the lines in the
                marker selects the marker. The default behavior for line markers requires the
                user to click exactly on the line to select the line marker.
                Enabling this feature can reduce performance.`,
          },
        },
        children: {
          centerline: {
            label: "centerline",
            fields: {
              color: {
                label: "Color",
                value: "#00ff00",
                input: "rgb",
              },
            },
          },
        },
      },
      lidar_top: {
        label: "/LIDAR_TOP",
        fields: {
          point_size: {
            label: "Point Size",
            input: "number",
            step: 0.1,
            value: 2,
          },
          point_shape: {
            label: "Point Shape",
            input: "toggle",
            value: "circle",
            options: [
              { label: "Circle", value: "circle" },
              { label: "Square", value: "square" },
            ],
          },
          decay_time: {
            label: "Decay Time (seconds)",
            input: "number",
            value: 0,
          },
        },
      },
      lidar_left: {
        label: "/LIDAR_LEFT",
        fields: {
          point_size: {
            label: "Point Size",
            input: "number",
            step: 2,
            value: 2,
          },
          point_shape: {
            label: "Point Shape",
            input: "toggle",
            value: "Circle",
            options: ["Circle", "Square"],
          },
          decay_time: {
            label: "Decay Time (seconds)",
            input: "number",
            value: 0,
          },
        },
      },
    },
  },
};

const FilterSettings: SettingsTreeNodes = {
  matchA: {
    label: "MatchA",
    children: { childA: { label: "ChildA" }, matchA: { label: "MatchA" } },
  },
  matchB: {
    label: "MatchB",
    children: { childB: { label: "ChildB" }, matchA: { label: "MatchA" } },
  },
  matchC: {
    label: "MatchC",
    children: { childC: { label: "ChildB" }, matchA: { label: "MatchC" } },
  },
};

const ColorSettings: SettingsTreeNodes = {
  colors: {
    fields: {
      undefined: { label: "Undefined", input: "rgb", value: undefined, placeholder: "placeholder" },
      invalid: { label: "Invalid", input: "rgb", value: "invalid" },
      hiddenClearButton: {
        label: "Hidden Clear Button",
        input: "rgb",
        value: "#00ffbf",
        hideClearButton: true,
      },
      hex6: { label: "Hex 6", input: "rgb", value: "#ffaa00" },
      hex8: { label: "Hex 8", input: "rgb", value: "#00aaff88" },
      rgb: { label: "RGB", input: "rgb", value: "rgb(255, 128, 0)" },
      rgba: { label: "RGBA", input: "rgba", value: "rgba(255, 0, 0, 0.5)" },
      rgbaBlack: { label: "RGBA Black", input: "rgba", value: "rgba(0, 0, 0, 1)" },
      rgbaWhite: { label: "RGBA White", input: "rgba", value: "rgba(255, 255, 255, 1)" },
      gradient: { label: "Gradient", input: "gradient", value: ["#000000", "#ffffff"] },
    },
  },
};

function updateSettingsTreeNodes(
  previous: SettingsTreeNodes,
  path: readonly string[],
  value: unknown,
): SettingsTreeNodes {
  const workingPath = [...path];
  return produce(previous, (draft) => {
    let node: undefined | Partial<SettingsTreeNode> = draft[workingPath[0]!];
    workingPath.shift();

    while (node != undefined && workingPath.length > 1) {
      const key = workingPath.shift()!;
      node = node.children?.[key];
    }

    if (!node) {
      return;
    }

    const key = workingPath.shift()!;
    if (key === "visible") {
      node.visible = Boolean(value);
    } else if (key === "label") {
      node.label = String(value);
    } else {
      const field = node.fields?.[key];
      if (field != undefined) {
        field.value = value as SettingsTreeFieldValue["value"];
      }
    }
  });
}

function makeBackgroundNode(index: number): SettingsTreeNode {
  return {
    label: `Background ${index}`,
    icon: "Background",
    fields: {
      url: { label: "URL", input: "string", value: "http://example.com/img.jpg" },
    },
    actions: [{ type: "action", id: "remove-background", label: "Remove Background" }],
  };
}

function makeGridNode(index: number): SettingsTreeNode {
  return {
    label: `Grid ${index}`,
    icon: "Grid",
    fields: {
      xsize: { label: "X Size", input: "number", value: 1 },
      ysize: { label: "Y Size", input: "number", value: 2 },
    },
    actions: [{ type: "action", id: "remove-grid", label: "Remove Grid" }],
  };
}

function Wrapper({ nodes }: { nodes: SettingsTreeNodes }): JSX.Element {
  const theme = useTheme();
  const [settingsNodes, setSettingsNodes] = useState({ ...nodes });
  const [dynamicNodes, setDynamicNodes] = useState<Record<string, SettingsTreeNode>>({});

  const actionHandler = useCallback(
    (action: SettingsTreeAction) => {
      log.info("Handling action", action);
      if (action.action === "perform-node-action") {
        if (action.payload.id === "add-grid") {
          const nodeCount = Object.keys(dynamicNodes).length;
          setDynamicNodes((oldNodes) => ({
            ...oldNodes,
            [`grid${nodeCount + 1}`]: makeGridNode(nodeCount + 1),
          }));
        }
        if (action.payload.id === "add-background") {
          const nodeCount = Object.keys(dynamicNodes).length;
          setDynamicNodes((oldNodes) => ({
            ...oldNodes,
            [`background${nodeCount + 1}`]: makeBackgroundNode(nodeCount + 1),
          }));
        }
        if (action.payload.id === "remove-grid" || action.payload.id === "remove-background") {
          setDynamicNodes((oldNodes) => {
            const newNodes = { ...oldNodes };
            delete newNodes[last(action.payload.path)!];
            return newNodes;
          });
        }
        return;
      }

      setSettingsNodes((previous) =>
        updateSettingsTreeNodes(previous, action.payload.path, action.payload.value),
      );
    },
    [dynamicNodes],
  );

  const settingsTree = useMemo(
    () => ({
      actionHandler,
      enableFilter: true,
      nodes: settingsNodes,
    }),
    [settingsNodes, actionHandler],
  );

  useEffect(() => {
    setSettingsNodes(
      produce((draft) => {
        if ("general" in draft) {
          (draft as any).general.children = dynamicNodes;
        }
      }),
    );
  }, [dynamicNodes]);

  return (
    <PanelSetup fixture={MessagePathInputStoryFixture}>
      <Stack fullWidth overflow="auto" style={{ background: theme.palette.background.paper }}>
        <SettingsTreeEditor settings={settingsTree} />
      </Stack>
    </PanelSetup>
  );
}

export const Basics: StoryObj = {
  render: function Story() {
    return <Wrapper nodes={BasicSettings} />;
  },

  play: () => {
    Array.from(document.querySelectorAll("[data-testid=node-actions-menu-button]"))
      .slice(0, 1)
      .forEach((node) => fireEvent.click(node));
  },
};

export const BasicsChinese: StoryObj = {
  ...Basics,
  parameters: { forceLanguage: "zh" },
};
export const BasicsJapanese: StoryObj = {
  ...Basics,
  parameters: { forceLanguage: "ja" },
};

export const DisabledFields: StoryObj = {
  render: () => {
    return <Wrapper nodes={DisabledSettings} />;
  },
};

export const ReadonlyFields: StoryObj = {
  render: () => {
    return <Wrapper nodes={ReadonlySettings} />;
  },
};

export const PanelExamples: StoryObj = {
  render: function Story() {
    return <Wrapper nodes={PanelExamplesSettings} />;
  },

  play: () => {
    Array.from(document.querySelectorAll("[data-node-function=edit-label]"))
      .slice(0, 1)
      .forEach((node) => {
        fireEvent.click(node);
        fireEvent.change(document.activeElement!, { target: { value: "Renamed Node" } });
        fireEvent.keyDown(document.activeElement!, { key: "Enter" });
      });
  },
};

export const IconExamples: StoryObj = {
  render: () => {
    return <Wrapper nodes={IconExamplesSettings} />;
  },
};

export const Topics: StoryObj = {
  render: () => {
    return <Wrapper nodes={TopicSettings} />;
  },
};

export const Filter: StoryObj = {
  render: function Story() {
    return <Wrapper nodes={FilterSettings} />;
  },

  play: () => {
    const node = document.querySelector("[data-testid=settings-filter-field] input");
    if (node) {
      fireEvent.click(node);
      fireEvent.change(node, { target: { value: "matcha" } });
    }
  },
};

export const Colors: StoryObj = {
  render: () => {
    return <Wrapper nodes={ColorSettings} />;
  },
};

export const EmptyValue: StoryObj = {
  render: () => {
    return <Wrapper nodes={ColorSettings} />;
  },
};

export const SetHiddenValueToTrue: StoryObj = {
  render: () => {
    return <Wrapper nodes={ColorSettings} />;
  },
};

export const Vec2: StoryObj = {
  render: () => {
    const settings: SettingsTreeNodes = {
      fields: {
        fields: {
          basic: {
            label: "Basic",
            input: "vec2",
          },
          labels: {
            label: "Custom Labels",
            input: "vec2",
            labels: ["A", "B"],
          },
          values: {
            label: "Values",
            input: "vec2",
            value: [1.1111, 2.2222],
          },
          someValues: {
            label: "Some values",
            input: "vec2",
            value: [1.1111, undefined],
          },
          placeholder: {
            label: "Placeholder",
            input: "vec2",
            placeholder: ["foo", "bar"],
            value: [1.1111, undefined],
          },
        },
      },
    };

    return <Wrapper nodes={settings} />;
  },
};

export const Vec3: StoryObj = {
  render: () => {
    const settings: SettingsTreeNodes = {
      fields: {
        fields: {
          basic: {
            label: "Basic",
            input: "vec3",
          },
          labels: {
            label: "Custom Labels",
            input: "vec3",
            labels: ["A", "B", "C"],
          },
          values: {
            label: "Values",
            input: "vec3",
            value: [1.1111, 2.2222, 3.333],
          },
          someValues: {
            label: "Some values",
            input: "vec3",
            value: [1.1111, undefined, 2.222],
          },
          placeholder: {
            label: "Placeholder",
            input: "vec3",
            placeholder: ["foo", "bar", "baz"],
            value: [1.1111, undefined, undefined],
          },
        },
      },
    };

    return <Wrapper nodes={settings} />;
  },
};

async function clickSelect(): Promise<void> {
  await userEvent.click(document.querySelector(".MuiSelect-select")!);
}

export const SelectInvalidWithUndefined: StoryObj = {
  render: function Story() {
    return <Wrapper nodes={SelectInvalidWithUndefinedSettings} />;
  },

  play: clickSelect,
};

export const SelectInvalidWithoutUndefined: StoryObj = {
  render: function Story() {
    return <Wrapper nodes={SelectInvalidWithoutUndefinedSettings} />;
  },

  play: clickSelect,
};

export const SelectValidWithUndefined: StoryObj = {
  render: function Story() {
    return <Wrapper nodes={SelectValidWithUndefinedSettings} />;
  },

  play: clickSelect,
};

export const SelectValidWithEmptyString: StoryObj = {
  render: function Story() {
    return <Wrapper nodes={SelectValidWithEmptyStringSettings} />;
  },

  play: clickSelect,
};

export const SelectEmpty: StoryObj = {
  render: function Story() {
    return <Wrapper nodes={SelectEmptySettings} />;
  },

  play: clickSelect,
};

export const SelectEmptyInvalid: StoryObj = {
  render: function Story() {
    return <Wrapper nodes={SelectEmptyInvalidSettings} />;
  },

  play: clickSelect,
};
