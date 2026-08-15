/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useTranslation } from "react-i18next";

import { useAgentChat } from "@lichtblick/suite-base/context/AgentChatContext";
import { LayoutProposal } from "@lichtblick/suite-base/services/agent/types";

import { LayoutPreviewCard } from "./LayoutPreviewCard";

const applyProposal = jest.fn().mockResolvedValue(undefined);
const dismissProposal = jest.fn();

jest.mock("react-i18next", () => ({
  useTranslation: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/context/AgentChatContext", () => ({
  useAgentChat: jest.fn(),
}));

const baseProposalData = {
  configById: { "Plot!speed": { paths: [] } },
  layout: "Plot!speed",
  globalVariables: {},
  playbackConfig: { speed: 1 },
  userNodes: {},
};

function makeProposal(overrides: Partial<LayoutProposal> = {}): LayoutProposal {
  return {
    name: "Vehicle overview",
    data: baseProposalData,
    ...overrides,
  };
}

const translations: Record<string, string> = {
  apply: "Apply",
  ignore: "Ignore",
  layoutProposal: "Layout proposal",
  layoutProposalAddPanels: "Add {{count}} panels to the current layout",
  layoutProposalNewLayout: "Create a new layout",
  userScriptsWarning:
    "Applying this layout will execute these scripts (they run in a SharedWorker without CPU or loop limits). Review the script source before applying.",
  userScriptsInputs: "Inputs: {{topics}}",
  userScriptsOutput: "Output: {{topic}}",
  userScriptsCannotParse: "Could not parse",
  userScriptsSource: "Script source",
  previousProposalApplying: "Previous proposal is still applying",
};

function renderCard(
  proposal: LayoutProposal,
  pendingProposalMode?: unknown,
): ReturnType<typeof render> {
  (useAgentChat as jest.Mock).mockImplementation(
    (selector: (state: unknown) => unknown) =>
      selector({
        actions: { applyProposal, dismissProposal },
        pendingProposalMode,
      }),
  );
  (useTranslation as jest.Mock).mockReturnValue({
    t: (key: string, options?: { defaultValue?: string } & Record<string, unknown>) => {
      const template = options?.defaultValue ?? translations[key] ?? key;
      if (options == undefined) {
        return template;
      }
      return template.replace(/\{\{(\w+)\}\}/g, (_match, name: string) =>
        String(options[name]),
      );
    },
  });
  return render(
    <LayoutPreviewCard
      proposal={proposal}
      proposalMessageId="message-1"
      proposalRequestId="request-1"
    />,
  );
}

describe("LayoutPreviewCard", () => {
  beforeEach(() => {
    applyProposal.mockClear();
    dismissProposal.mockClear();
  });

  it("shows the incremental mode with the new panel count", () => {
    renderCard(
      makeProposal({ baseLayoutId: "layout-1", baseFingerprint: "abc" }),
      { kind: "incremental", newPanelCount: 2 },
    );
    expect(screen.getByText("Add 2 panels to the current layout")).toBeInTheDocument();
  });

  it("shows the new-layout mode", () => {
    renderCard(makeProposal(), { kind: "new" });
    expect(screen.getByText("Create a new layout")).toBeInTheDocument();
  });

  it("shows no mode label when no mode is available", () => {
    renderCard(makeProposal());
    expect(screen.queryByText(/panels to the current layout/)).not.toBeInTheDocument();
    expect(screen.queryByText("Create a new layout")).not.toBeInTheDocument();
  });

  it("applies and dismisses through the chat actions", async () => {
    renderCard(makeProposal());
    await act(async () => {
      fireEvent.click(screen.getByText("Apply"));
    });
    expect(applyProposal).toHaveBeenCalledTimes(1);
    await act(async () => {
      fireEvent.click(screen.getByText("Ignore"));
    });
    expect(dismissProposal).toHaveBeenCalledTimes(1);
  });

  describe("user scripts (N7 spec)", () => {
    const scriptA = {
      name: "Speed km/h",
      sourceCode: `export const inputs = ["/imu/data", "/gps/fix"];
export const output = "/studio_script/speed";
export default function (event) { return event; }`,
    };
    const scriptB = {
      name: "GPS fix",
      sourceCode: `export const inputs = ['/gps']; export const output = '/studio_script/gps';`,
    };

    it("shows every script's name, id, inputs, and output with the warning and collapsed source", () => {
      const { container } = renderCard(
        makeProposal({
          data: {
            ...baseProposalData,
            userNodes: {
              "script-b": scriptB,
              "script-a": scriptA,
            },
          },
        }),
        { kind: "new" },
      );

      // Warning banner is always visible, even with sources collapsed.
      expect(
        screen.getByText(/Applying this layout will execute these scripts/),
      ).toBeInTheDocument();

      expect(screen.getByText("Speed km/h")).toBeInTheDocument();
      expect(screen.getByText("(script-a)")).toBeInTheDocument();
      expect(screen.getByText("GPS fix")).toBeInTheDocument();
      expect(screen.getByText("(script-b)")).toBeInTheDocument();

      expect(
        screen.getByText("Inputs: /imu/data, /gps/fix"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Output: /studio_script/speed"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Inputs: /gps"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Output: /studio_script/gps"),
      ).toBeInTheDocument();

      // Sources are collapsed by default and expand on demand. The pre content stays in the
      // DOM while collapsed (details hides it), so assert on the open attribute instead.
      const details = container.querySelectorAll("details");
      expect(details).toHaveLength(2);
      for (const element of details) {
        expect(element).not.toHaveAttribute("open");
      }
      fireEvent.click(screen.getAllByText("Script source")[0]!);
      expect(details[0]).toHaveAttribute("open");
      expect(details[1]).not.toHaveAttribute("open");
    });

    it("renders no script section when the proposal has no userNodes", () => {
      renderCard(makeProposal(), { kind: "new" });
      expect(screen.queryByText(/Applying this layout will execute these scripts/)).not.toBeInTheDocument();
      expect(screen.queryByText("Script source")).not.toBeInTheDocument();
    });

    it("shows parse placeholders for malformed source code without crashing", () => {
      renderCard(
        makeProposal({
          data: {
            ...baseProposalData,
            userNodes: {
              "script-c": {
                name: "Broken",
                sourceCode: "export default function () { return 1; }",
              },
            },
          },
        }),
        { kind: "new" },
      );

      expect(screen.getByText("Broken")).toBeInTheDocument();
      expect(screen.getAllByText("Could not parse")).toHaveLength(2);    });
  });
});
