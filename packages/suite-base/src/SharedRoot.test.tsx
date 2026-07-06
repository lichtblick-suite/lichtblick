/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { render, screen } from "@testing-library/react";

import { useAppParameters } from "@lichtblick/suite-base/context/AppParametersContext";
import { IDataSourceFactory } from "@lichtblick/suite-base/context/PlayerSelectionContext";
import { makeMockAppConfiguration } from "@lichtblick/suite-base/util/makeMockAppConfiguration";
import { BasicBuilder } from "@lichtblick/test-builders";

import { SharedRoot } from "./SharedRoot";
import { useSharedRootContext } from "./context/SharedRootContext";

jest.mock("./components/ColorSchemeThemeProvider", () => ({
  ColorSchemeThemeProvider: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));
jest.mock("./components/CssBaseline", () => ({
  __esModule: true,
  default: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));
jest.mock("./components/ErrorBoundary", () => ({
  __esModule: true,
  default: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));
jest.mock("./components/GlobalCss", () => ({
  __esModule: true,
  default: () => <></>,
}));

function Consumer(): React.JSX.Element {
  const params = useAppParameters();
  const ctx = useSharedRootContext();
  return (
    <>
      <span data-testid="from-provider">{params.defaultLayout ?? "none"}</span>
      <span data-testid="from-context">{ctx.appParameters?.defaultLayout ?? "none"}</span>
    </>
  );
}

const renderSharedRoot = (
  options: { appParameters?: Record<string, string>; enableGlobalCss?: boolean } = {},
) => {
  const { appParameters, enableGlobalCss = false } = options;
  const dataSources: IDataSourceFactory[] = [];
  return render(
    <SharedRoot
      deepLinks={[]}
      dataSources={dataSources}
      extensionLoaders={[]}
      appConfiguration={makeMockAppConfiguration()}
      appParameters={appParameters}
      enableGlobalCss={enableGlobalCss}
    >
      <Consumer />
    </SharedRoot>,
  );
};

describe("SharedRoot", () => {
  const layout = BasicBuilder.string();
  it("threads appParameters into the AppParametersProvider", () => {
    renderSharedRoot({ appParameters: { defaultLayout: layout } });
    expect(screen.getByTestId("from-provider").textContent).toBe(layout);
  });

  it("exposes appParameters through the SharedRootContext", () => {
    renderSharedRoot({ appParameters: { defaultLayout: layout } });
    expect(screen.getByTestId("from-context").textContent).toBe(layout);
  });

  it("defaults to empty appParameters when none are provided", () => {
    renderSharedRoot();
    expect(screen.getByTestId("from-provider").textContent).toBe("none");
    expect(screen.getByTestId("from-context").textContent).toBe("none");
  });

  it("renders children when global CSS is enabled", () => {
    renderSharedRoot({ appParameters: { defaultLayout: layout }, enableGlobalCss: true });
    expect(screen.getByTestId("from-context").textContent).toBe(layout);
  });
});
