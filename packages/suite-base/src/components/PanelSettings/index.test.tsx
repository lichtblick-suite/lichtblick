/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { render, screen } from "@testing-library/react";

import { PanelCatalog, PanelInfo } from "@lichtblick/suite-base/context/PanelCatalogContext";
import PanelSetup, { Fixture } from "@lichtblick/suite-base/stories/PanelSetup";
import { BasicBuilder } from "@lichtblick/test-builders";

import PanelSettings from ".";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("@lichtblick/suite-base/hooks", () => ({
  ...jest.requireActual("@lichtblick/suite-base/hooks"),
  useAppConfigurationValue: jest.fn().mockReturnValue([true, jest.fn()]),
}));

const panelType = BasicBuilder.string();
const panelId = `${panelType}!${BasicBuilder.string()}`;

const defaultPanels: readonly PanelInfo[] = [
  {
    title: BasicBuilder.string(),
    type: panelType,
    module: async () => await new Promise(() => {}),
  },
];

class MockPanelCatalog implements PanelCatalog {
  public getPanels(): readonly PanelInfo[] {
    return defaultPanels;
  }
  public getPanelByType(type: string): PanelInfo | undefined {
    return defaultPanels.find((panel) => panel.type === type);
  }
}

const baseFixture: Fixture = {
  topics: [],
  datatypes: new Map(),
  frame: {},
  layout: panelId,
};

function setup(selectedPanelIdsForTests: readonly string[], fixture: Fixture = baseFixture) {
  return render(
    <PanelSetup panelCatalog={new MockPanelCatalog()} fixture={fixture}>
      <PanelSettings selectedPanelIdsForTests={selectedPanelIdsForTests} />
    </PanelSetup>,
  );
}

describe("PanelSettings", () => {
  it("shows empty state when no panel is selected", () => {
    // Given
    setup([]);
    // Then
    expect(screen.getByText("selectAPanelToEditItsSettings")).toBeDefined();
  });

  it("shows loading state when panel is selected but config is not yet available", () => {
    // Given/When
    setup([panelId]);
    // Then
    expect(screen.getByText("loadingPanelSettings")).toBeDefined();
  });

  it("renders the settings tree editor when panel has a settings tree", () => {
    // Given/When
    setup([panelId], {
      ...baseFixture,
      savedProps: { [panelId]: { someKey: "someVal" } },
      panelState: {
        settingsTrees: {
          [panelId]: {
            actionHandler: () => undefined,
            nodes: {},
          },
        },
      },
    });
    // Then
    expect(screen.queryByText("panelDoesNotHaveSettings")).toBeNull();
    expect(screen.queryByText("loadingPanelSettings")).toBeNull();
  });

  it("shows no-settings message when panel has config but no settings tree", () => {
    // Given/When
    // Use an unknown panel type so panelInfo is undefined (showTitleField = false)
    const unknownPanelId = "UnknownType!xyz";
    setup([unknownPanelId], {
      ...baseFixture,
      savedProps: { [unknownPanelId]: { someKey: "someVal" } },
    });
    // Then
    expect(screen.getByText("panelDoesNotHaveSettings")).toBeDefined();
  });
});
