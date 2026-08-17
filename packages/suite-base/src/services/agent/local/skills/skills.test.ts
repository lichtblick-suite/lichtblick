// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import generateRosLib from "@lichtblick/suite-base/players/UserScriptPlayer/transformerWorker/generateRosLib";
import { generateTypesLib } from "@lichtblick/suite-base/players/UserScriptPlayer/transformerWorker/generateTypesLib";
import transform from "@lichtblick/suite-base/players/UserScriptPlayer/transformerWorker/transform";
import {
  AGENT_SAFE_LAYOUT_MAX_COLLECTION_ENTRIES,
  AGENT_SAFE_LAYOUT_MAX_CONFIG_BY_ID_ENTRIES,
  AGENT_SAFE_LAYOUT_MAX_GRAPH_DEPTH,
  AGENT_SAFE_LAYOUT_MAX_GRAPH_NODES,
  AGENT_SAFE_LAYOUT_MAX_MOSAIC_DEPTH,
  AGENT_SAFE_LAYOUT_MAX_STRING_BYTES,
  ALLOWED_PANEL_TYPES,
  validateLayoutProposalData,
} from "@lichtblick/suite-base/services/agent/layoutSchema";

import { LOCAL_AGENT_TOOL_DEFINITIONS } from "../toolDefinitions";
import { SKILL_IDS, SKILL_REGISTRY, buildSkillIndex, renderSkill } from "./index";
import {
  LOG_TROUBLESHOOTING_LAYOUT,
  REPLAY_ANALYSIS_LAYOUT,
  ROBOT_DEBUG_LAYOUT,
  SENSOR_MONITORING_LAYOUT,
} from "./layoutAuthoring";

describe("skill registry", () => {
  it("keeps ids unique and in sync with the load_skill schema enum", () => {
    const registryIds = [...SKILL_REGISTRY.keys()];
    expect(new Set(registryIds).size).toBe(registryIds.length);
    expect([...SKILL_IDS].sort()).toEqual([...registryIds].sort());

    const loadSkill = LOCAL_AGENT_TOOL_DEFINITIONS.find((tool) => tool.name === "load_skill");
    const schemaEnum = (
      loadSkill?.inputSchema as {
        properties?: { skillId?: { enum?: string[] } };
      }
    ).properties?.skillId?.enum;
    expect(schemaEnum?.slice().sort()).toEqual([...registryIds].sort());
  });

  it("gives every skill a kebab-case id, a trigger line, and a non-trivial body", () => {
    for (const skill of SKILL_REGISTRY.values()) {
      expect(skill.id).toMatch(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/);
      expect(skill.name.length).toBeGreaterThan(0);
      expect(skill.whenToUse.length).toBeGreaterThan(0);
      expect(skill.body.length).toBeGreaterThan(500);
    }
    // The prompt index budget applies to indexed skills only: their trigger line is the one the
    // agent sees up front, so it must stay cheap.
    for (const skill of [...SKILL_REGISTRY.values()].filter((s) => s.indexed !== false)) {
      expect(skill.whenToUse.length).toBeLessThan(140);
    }
  });

  it("marks exactly the per-panel skills as non-indexed", () => {
    const nonIndexed = [...SKILL_REGISTRY.values()].filter((skill) => skill.indexed === false);
    // Every non-indexed skill is a panel-* reference skill, and every panel-* skill is
    // non-indexed: the two sets coincide.
    expect(nonIndexed.length).toBeGreaterThan(0);
    for (const skill of nonIndexed) {
      expect(skill.id).toMatch(/^panel-[a-z0-9-]+$/);
      expect(skill.id).not.toBe("panel-catalog");
    }
    for (const skill of [...SKILL_REGISTRY.values()].filter(
      (s) => s.id.startsWith("panel-") && s.id !== "panel-catalog",
    )) {
      expect(skill.indexed).toBe(false);
    }
  });

  it("indexes only indexed skills on their own lines without leaking bodies", () => {
    const indexed = [...SKILL_REGISTRY.values()].filter((skill) => skill.indexed !== false);
    const index = buildSkillIndex();
    for (const skill of indexed) {
      expect(index).toContain(`- ${skill.id}: ${skill.whenToUse}`);
    }
    // Non-indexed skills must not sneak into the index through any formatting variant.
    for (const skill of [...SKILL_REGISTRY.values()].filter((s) => s.indexed === false)) {
      expect(index).not.toContain(`- ${skill.id}:`);
    }
    // Bodies stay behind load_skill for every skill, indexed or not.
    for (const skill of SKILL_REGISTRY.values()) {
      expect(index).not.toContain(skill.body);
    }
    expect(index.split("\n")).toHaveLength(indexed.length);
    // Budget: the whole index stays under 1000 chars even as the registry grows.
    expect(index.length).toBeLessThan(1000);
  });

  it("reaches every non-indexed skill from the panel-catalog body", () => {
    const catalog = SKILL_REGISTRY.get("panel-catalog")!.body;
    const nonIndexed = [...SKILL_REGISTRY.values()].filter((skill) => skill.indexed === false);
    // No dangling references: each non-indexed skill must be named by the router that the agent
    // reads before choosing panels, so it stays discoverable without an index line.
    for (const skill of nonIndexed) {
      expect(catalog).toContain(skill.id);
    }
  });

  it("tags a rendered skill with the id used to load it", () => {
    const skill = SKILL_REGISTRY.get("data-query")!;
    const rendered = renderSkill(skill);
    expect(rendered).toContain('<skill id="data-query">');
    expect(rendered).toContain(skill.body);
  });

  it("documents every allowlisted panel type in some skill", () => {
    // A panel the agent may propose but no skill describes is a panel it will use badly.
    const documented = [...SKILL_REGISTRY.values()].map((skill) => skill.body).join("\n");
    for (const panelType of ALLOWED_PANEL_TYPES) {
      expect(documented).toContain(panelType);
    }
  });

  it("documents the RosOut panel's exact schema allowlist and config defaults", () => {
    const catalog = SKILL_REGISTRY.get("panel-rosout")!.body;
    const expectedSchemas = [
      "foxglove_msgs/Log",
      "foxglove_msgs/msg/Log",
      "foxglove.Log",
      "foxglove::Log",
      "rcl_interfaces/msg/Log",
      "ros.rcl_interfaces.Log",
      "ros.rosgraph_msgs.Log",
      "rosgraph_msgs/Log",
    ];
    // The documented schema list must be exactly these eight, in order: a missing, extra, or
    // renamed entry fails the exact equality.
    const schemasBlock = catalog.match(/never through `convertibleTo`:\n\n```\n([\s\S]*?)\n```/);
    expect(schemasBlock?.[1]).toBeDefined();
    const documentedSchemas = schemasBlock![1]!
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    expect(documentedSchemas).toEqual(expectedSchemas);

    // Exact matching: convertibleTo must not qualify a topic for RosOut.
    expect(catalog).toMatch(/RosOut is the exception/);
    expect(catalog).toMatch(/does not qualify/);
    expect(catalog).toMatch(/matched exactly/);
    // Config fields, defaults, fallback behavior, and bare-config validity, as read from
    // panels/Log.
    for (const field of ["topicToRender", "minLogLevel", "searchTerms", "nameFilter"]) {
      expect(catalog).toContain(field);
    }
    expect(catalog).toContain("minLogLevel` (default `1`)");
    expect(catalog).toContain("searchTerms` (default `[]`)");
    expect(catalog).toMatch(/the first available topic with a\s+supported schema/);
    expect(catalog).toContain("falls back to `/rosout`");
    expect(catalog).toContain("A bare `{}` config is valid");
    expect(catalog).toMatch(/DEBUG=1,\s+INFO=2,\s+WARN=3,\s+ERROR=4,\s+FATAL=5/);
  });

  it("assigns every allowlisted panel type to a per-panel skill", () => {
    // Each allowlisted panel type owns exactly one panel-* skill that documents it,
    // and the catalog routes to that skill. A missing, extra, or renamed mapping fails here.
    const panelSkillByType: Record<string, string> = {
      "3D": "panel-3d",
      Plot: "panel-plot",
      Image: "panel-image",
      RawMessages: "panel-raw-messages",
      RawMessagesVirtual: "panel-raw-messages-virtual",
      Table: "panel-table",
      Gauge: "panel-gauge",
      map: "panel-map",
      StateTransitions: "panel-state-transitions",
      Indicator: "panel-indicator",
      PieChart: "panel-pie-chart",
      SourceInfo: "panel-source-info",
      RosOut: "panel-rosout",
    };
    const catalog = SKILL_REGISTRY.get("panel-catalog")!.body;
    for (const [panelType, skillId] of Object.entries(panelSkillByType)) {
      const skill = SKILL_REGISTRY.get(skillId);
      expect(skill).toBeDefined();
      expect(skill!.indexed).toBe(false);
      // The body documents the exact panel-type string, not just a lookalike substring.
      expect(skill!.body).toContain(`\`${panelType}\``);
      expect(catalog).toContain(skillId);
    }
  });

  it("registers every non-indexed skill in the load_skill enum", () => {
    const loadSkill = LOCAL_AGENT_TOOL_DEFINITIONS.find((tool) => tool.name === "load_skill");
    const schemaEnum = (
      loadSkill?.inputSchema as {
        properties?: { skillId?: { enum?: string[] } };
      }
    ).properties?.skillId?.enum;
    for (const skill of [...SKILL_REGISTRY.values()].filter((s) => s.indexed === false)) {
      expect(schemaEnum).toContain(skill.id);
    }
  });

  it("points panel availability decisions to the live inventory", () => {
    const catalog = SKILL_REGISTRY.get("panel-catalog")!.body;
    expect(catalog).toContain('"Available panels" is authoritative');
    expect(catalog).not.toContain("Panels not listed here cannot be proposed");
  });

  it("requires one complete layout proposal instead of incremental skeletons", () => {
    const layoutAuthoring = SKILL_REGISTRY.get("layout-authoring")!.body;
    expect(layoutAuthoring).toContain("Build the entire layout internally");
    expect(layoutAuthoring).toContain("Call `propose_layout` exactly once");
    expect(layoutAuthoring).toContain("Never submit a skeleton, placeholder, or partial layout");
    expect(layoutAuthoring).toContain("`get_data_catalog`");
    expect(layoutAuthoring).toContain("Available panels");
    expect(layoutAuthoring).toContain("Only propose again within the same request");
    expect(layoutAuthoring).toContain("one complete revised version at a time");
  });

  it("routes panel selection on catalog evidence and forbids guessing fields", () => {
    const catalog = SKILL_REGISTRY.get("panel-catalog")!.body;
    // T2: catalog evidence first — get_data_catalog only for truncation, a missing topic, or a
    // needed field chain.
    expect(catalog).toMatch(/workspace summary/);
    expect(catalog).toMatch(/catalog-ready/);
    expect(catalog).toMatch(/Call `get_data_catalog` \*\*only\*\* when/);
    expect(catalog).toMatch(/truncated/);
    expect(catalog).toMatch(/field structure/);
    // Degradation for a truncated catalog: minimal fetch, schema-driven fallback.
    expect(catalog).toMatch(/one call per need/);
    // Never guess fields when the datatype structure is not visible.
    expect(catalog).toMatch(/never guess a field name or a messagePath/);
    expect(catalog).toMatch(/schema-driven panel/);
    expect(catalog).toMatch(/ask the user/);
    // The decision table is a multi-to-many candidate map, not a hard rule.
    expect(catalog).toMatch(/\*\*candidates, not hard rules\*\*/);
    expect(catalog).toMatch(/Available panels.*always wins/);
    // Schema aliases and the convertibleTo boundary live at routing level.
    expect(catalog).toContain("pkg/msg/Type");
    expect(catalog).toContain("convertibleTo");
    // Per-panel loading instruction.
    expect(catalog).toMatch(/load its `panel-\*` skill/);
  });

  it("records the rendering constraints that layout validation cannot enforce", () => {
    // A Plot path without `enabled` validates but renders nothing — the failure the per-panel
    // skills exist to prevent.
    expect(SKILL_REGISTRY.get("panel-plot")!.body).toContain('"enabled": true');
    expect(SKILL_REGISTRY.get("panel-pie-chart")!.body).toContain("float32[]");
    expect(SKILL_REGISTRY.get("panel-3d")!.body).toContain('"visible": true');
    // The router points at the per-panel skills instead of repeating every constraint.
    const catalog = SKILL_REGISTRY.get("panel-catalog")!.body;
    for (const skillId of ["panel-plot", "panel-pie-chart", "panel-3d"]) {
      expect(catalog).toContain(skillId);
    }
  });

  it("documents the Indicator scalar-path rule and the Gauge reverse semantics", () => {
    // Verified against the sources: Indicator.tsx maps a resolved message object to undefined, so
    // a topic root must not be proposed; Gauge's reverse only mirrors the color gradient.
    const indicator = SKILL_REGISTRY.get("panel-indicator")!.body;
    expect(indicator).toMatch(/must resolve to the scalar field itself/);
    expect(indicator).toMatch(/\/std_msgs_bool_topic\.data/);
    expect(indicator).toMatch(/treats as no value/);
    // The worked example itself must point at a scalar field, never at a topic root.
    expect(indicator).toContain('"path": "/system/healthy.data"');
    expect(indicator).not.toContain('"path": "/system/healthy"');
    // The layout pattern library example carries the same corrected path.
    expect(SKILL_REGISTRY.get("layout-authoring")!.body).toContain(
      '"path": "/system/healthy.data"',
    );
    const gauge = SKILL_REGISTRY.get("panel-gauge")!.body;
    expect(gauge).toMatch(/pointer position is unaffected/);
    // The catalog decision table says the same thing.
    expect(SKILL_REGISTRY.get("panel-catalog")!.body).toMatch(
      /topic root resolves to the message object/,
    );
  });

  it("validates every layout pattern library example as executable layout data", () => {
    const examples = [
      ROBOT_DEBUG_LAYOUT,
      SENSOR_MONITORING_LAYOUT,
      LOG_TROUBLESHOOTING_LAYOUT,
      REPLAY_ANALYSIS_LAYOUT,
    ];
    for (const example of examples) {
      // The example must be a valid proposal as written in the skill body...
      expect(() => validateLayoutProposalData(example)).not.toThrow();
      // ...and after the JSON round-trip a proposal crosses in transit. The examples are pure
      // JSON, so stringify never returns undefined; the fallback only satisfies the type.
      const roundTripped: unknown = JSON.parse(JSON.stringify(example) ?? "null");
      expect(() => validateLayoutProposalData(roundTripped)).not.toThrow();
      // Examples stay far inside the documented budgets: at most 5 panels.
      expect(Object.keys(example.configById).length).toBeLessThanOrEqual(5);
    }
  });

  it("documents the layout pattern library and every budget boundary in the skill body", () => {
    const layoutAuthoring = SKILL_REGISTRY.get("layout-authoring")!.body;
    expect(layoutAuthoring).toContain("Layout pattern library");
    for (const heading of [
      "Robot debugging",
      "Sensor monitoring",
      "Log troubleshooting",
      "Replay analysis",
      "Budget boundaries",
    ]) {
      expect(layoutAuthoring).toContain(heading);
    }
    // Proportions are advice, not enforced limits.
    expect(layoutAuthoring).toMatch(/suggestions, not hard\s+limits/);
    // Every exported budget constant is spelled out with its current value.
    for (const budget of [
      AGENT_SAFE_LAYOUT_MAX_COLLECTION_ENTRIES,
      AGENT_SAFE_LAYOUT_MAX_CONFIG_BY_ID_ENTRIES,
      AGENT_SAFE_LAYOUT_MAX_GRAPH_DEPTH,
      AGENT_SAFE_LAYOUT_MAX_GRAPH_NODES,
      AGENT_SAFE_LAYOUT_MAX_MOSAIC_DEPTH,
      AGENT_SAFE_LAYOUT_MAX_STRING_BYTES,
    ]) {
      expect(layoutAuthoring).toContain(String(budget));
    }
  });

  it("documents the data-query tools: usage, first-error flow, live-source limits, and scan caps", () => {
    const dataQuery = SKILL_REGISTRY.get("data-query")!;
    expect(dataQuery.id).toBe("data-query");
    // Indexed: the capability is advertised in the prompt index, not hidden behind a router.
    expect(buildSkillIndex()).toContain("- data-query:");

    for (const tool of ["read_messages", "search_messages", "playback_control"]) {
      expect(dataQuery.body).toContain(tool);
    }
    // The first-error playbook: search level=error limit=1 then seek its receiveTimeNs.
    expect(dataQuery.body).toMatch(/level: "error", limit: 1/);
    expect(dataQuery.body).toMatch(/receiveTimeNs/);
    // Live sources cannot be read; playback may be per-action unavailable.
    expect(dataQuery.body).toMatch(/live source/);
    expect(dataQuery.body).toMatch(/50,000/);
    expect(dataQuery.body).toMatch(/decimal nanoseconds/);
  });

  describe("user-scripts skill", () => {
    it("is indexed in the prompt index", () => {
      const index = buildSkillIndex();
      expect(index).toContain("- user-scripts:");
    });

    it("documents the script format, constraints, and the NodePlayground exclusion", () => {
      const userScripts = SKILL_REGISTRY.get("user-scripts")!;
      expect(userScripts.whenToUse).toMatch(/derived|transformed|aggregated/i);
      const body = userScripts.body;
      // Format elements: inputs/output/default export with the collision-avoiding prefix.
      expect(body).toContain("export const inputs");
      expect(body).toContain("export const output");
      expect(body).toContain("export default function");
      expect(body).toContain("/studio_script/");
      expect(body).toContain("must start with `/studio_script/`");
      // Inputs come from the catalog, never from memory.
      expect(body).toMatch(/inputs` must name real topics from the loaded catalog/);
      // Scripts travel in userNodes with exactly { name, sourceCode }.
      expect(body).toContain("userNodes");
      expect(body).toContain("name` and `sourceCode`");
      expect(body).toContain("Layout validation enforces exactly");
      // Self-containment is a behavior convention, not a security control.
      expect(body).toContain("no `fetch`");
      expect(body).toMatch(/behavior convention, not a security control/);
      // The return value must be an object: the pipeline derives the datatype from it, and a
      // bare number/string return is rejected (BAD_TYPE_RETURN).
      expect(body).toMatch(/must return an object with at least one field/);
      expect(body).toContain("BAD_TYPE_RETURN");
      // NodePlayground is never proposed.
      expect(body).toContain("NodePlayground");
      expect(body).toMatch(/must never be proposed/);
      // The recorded risk decision is present.
      expect(body).toMatch(/without CPU or loop limits/);
    });

    it("compiles a representative agent-generated script through the transformer worker", () => {
      const sourceCode = `import { Input, Message } from "./types";

type Twist = Message<"geometry_msgs/TwistStamped">;

type Output = {
  speedKmh: number;
};

export const inputs = ["/odom"];

export const output = "/studio_script/speed_kmh";

export default function script(event: Input<"/odom">): Output {
  const twist: Twist = event.message;
  return { speedKmh: twist.twist.linear.x * 3.6 };
}`;
      const topics = [{ name: "/odom", schemaName: "geometry_msgs/TwistStamped" }];
      const datatypes = new Map([
        [
          "geometry_msgs/TwistStamped",
          {
            name: "geometry_msgs/TwistStamped",
            definitions: [
              {
                arrayLength: undefined,
                isArray: false,
                isComplex: true,
                name: "twist",
                type: "geometry_msgs/Twist",
              },
            ],
          },
        ],
        [
          "geometry_msgs/Twist",
          {
            name: "geometry_msgs/Twist",
            definitions: [
              {
                arrayLength: undefined,
                isArray: false,
                isComplex: true,
                name: "linear",
                type: "geometry_msgs/Vector3",
              },
            ],
          },
        ],
        [
          "geometry_msgs/Vector3",
          {
            name: "geometry_msgs/Vector3",
            definitions: [
              {
                arrayLength: undefined,
                isArray: false,
                isComplex: false,
                name: "x",
                type: "float64",
              },
            ],
          },
        ],
      ]);
      // Run the full production pipeline (getOutputTopic → compile → getInputTopics →
      // validateInputTopics → extractDatatypes → extractGlobalVariables), not just compile(): the
      // return type must yield an object datatype or extractDatatypes reports BAD_TYPE_RETURN and
      // the output topic is untyped.
      const result = transform({
        datatypes,
        name: "speed-converter",
        rosLib: generateRosLib({ topics, datatypes }),
        sourceCode,
        topics,
        typesLib: generateTypesLib({ topics, datatypes }),
      });

      expect(result.diagnostics).toHaveLength(0);
      expect(result.transpiledCode.length).toBeGreaterThan(0);
      expect(result.inputTopics).toEqual(["/odom"]);
      expect(result.outputTopic).toEqual("/studio_script/speed_kmh");
      // The object return type derives a datatype named after the script, and it is registered.
      expect(result.outputDatatype).toBe("speed-converter");
      expect(result.datatypes.has("speed-converter")).toBe(true);
    });
  });

  describe("layout panel titles", () => {
    // Panels whose custom toolbar never renders the title (see the layout-authoring skill).
    const TITLELESS_EXCEPTIONS = new Set(["Table", "RawMessages", "RawMessagesVirtual"]);

    it("documents the lichtblickPanelTitle rule and its exceptions", () => {
      const layoutAuthoring = SKILL_REGISTRY.get("layout-authoring")!.body;
      expect(layoutAuthoring).toContain("lichtblickPanelTitle");
      expect(layoutAuthoring).toMatch(/must include `lichtblickPanelTitle`/);
      for (const exception of ["Table", "RawMessages", "RawMessagesVirtual"]) {
        expect(layoutAuthoring).toContain(`\`${exception}\``);
      }
      // Extension panels write a title anyway.
      expect(layoutAuthoring).toMatch(/Extension panels/);
    });

    it("gives every non-exception panel in the four pattern layouts a non-empty title", () => {
      const examples = [
        ROBOT_DEBUG_LAYOUT,
        SENSOR_MONITORING_LAYOUT,
        LOG_TROUBLESHOOTING_LAYOUT,
        REPLAY_ANALYSIS_LAYOUT,
      ];
      for (const example of examples) {
        for (const [panelId, config] of Object.entries(example.configById)) {
          const panelType = panelId.slice(0, panelId.indexOf("!"));
          if (TITLELESS_EXCEPTIONS.has(panelType)) {
            continue;
          }
          const title = (config as { lichtblickPanelTitle?: unknown }).lichtblickPanelTitle;
          expect(typeof title).toBe("string");
          expect((title as string).length).toBeGreaterThan(0);
        }
      }
    });

    it("leaves no title-less example config in the layout-authoring body", () => {
      const body = SKILL_REGISTRY.get("layout-authoring")!.body;
      const blocks = [...body.matchAll(/```json\n([\s\S]*?)\n```/g)]
        .map((match) => match[1])
        .filter((block): block is string => block != undefined);
      expect(blocks.length).toBeGreaterThan(0);
      let checkedConfigs = 0;
      for (const block of blocks) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(block);
        } catch {
          // Placeholder examples (e.g. the Structure sketch with `/* panel config */`) are not
          // parseable JSON; they carry no concrete panel config to check.
          continue;
        }
        if (
          typeof parsed !== "object" ||
          parsed == undefined ||
          Array.isArray(parsed) ||
          typeof (parsed as { configById?: unknown }).configById !== "object" ||
          (parsed as { configById?: unknown }).configById == undefined
        ) {
          // Split-only snippets without configById have nothing to check.
          continue;
        }
        for (const [panelId, config] of Object.entries(
          (parsed as { configById: Record<string, Record<string, unknown>> }).configById,
        )) {
          const panelType = panelId.slice(0, panelId.indexOf("!"));
          if (TITLELESS_EXCEPTIONS.has(panelType)) {
            continue;
          }
          expect(typeof config.lichtblickPanelTitle).toBe("string");
          checkedConfigs++;
        }
      }
      expect(checkedConfigs).toBeGreaterThan(0);
    });
  });
});
