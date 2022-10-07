// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import DiagnosticStatusPanel from "@foxglove/studio-base/panels/diagnostics/DiagnosticStatusPanel";
import { makeDiagnosticMessage } from "@foxglove/studio-base/panels/diagnostics/DiagnosticSummary.stories";
import { LEVELS } from "@foxglove/studio-base/panels/diagnostics/util";
import PanelSetup, { Fixture } from "@foxglove/studio-base/stories/PanelSetup";

export default {
  title: "panels/diagnostics/DiagnosticStatusPanel",
};

const fixture: Fixture = {
  topics: [{ name: "/diagnostics", schemaName: "diagnostic_msgs/DiagnosticArray" }],
  frame: {
    "/diagnostics": [
      makeDiagnosticMessage(LEVELS.OK, "name1", "hardware_id1", ["message 1", "message 2"]),
      makeDiagnosticMessage(
        LEVELS.OK,
        "name2",
        "hardware_id1",
        ["message 3"],
        [
          { key: "key", value: "value" },
          { key: "key <b>with html</b>", value: "value <tt>with html</tt>" },
        ],
      ),
    ],
  },
};

export function Empty(): JSX.Element {
  return (
    <PanelSetup fixture={fixture}>
      <DiagnosticStatusPanel />
    </PanelSetup>
  );
}

export function WithSettings(): JSX.Element {
  return (
    <PanelSetup fixture={fixture} includeSettings>
      <DiagnosticStatusPanel
        overrideConfig={{
          topicToRender: "/diagnostics",
          selectedHardwareId: "hardware_id1",
          selectedName: "name2",
        }}
      />
    </PanelSetup>
  );
}

export function SelectedHardwareIDOnly(): JSX.Element {
  return (
    <PanelSetup fixture={fixture}>
      <DiagnosticStatusPanel
        overrideConfig={{
          topicToRender: "/diagnostics",
          selectedHardwareId: "hardware_id1",
          selectedName: undefined,
        }}
      />
    </PanelSetup>
  );
}

export function SelectedName(): JSX.Element {
  return (
    <PanelSetup fixture={fixture}>
      <DiagnosticStatusPanel
        overrideConfig={{
          topicToRender: "/diagnostics",
          selectedHardwareId: "hardware_id1",
          selectedName: "name2",
        }}
      />
    </PanelSetup>
  );
}

export function MovedDivider(): JSX.Element {
  return (
    <PanelSetup fixture={fixture}>
      <DiagnosticStatusPanel
        overrideConfig={{
          topicToRender: "/diagnostics",
          selectedHardwareId: "hardware_id1",
          selectedName: undefined,
          splitFraction: 0.25,
        }}
      />
    </PanelSetup>
  );
}
