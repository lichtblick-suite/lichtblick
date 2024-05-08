/** @jest-environment jsdom */
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { screen } from "@testing-library/react";
import { act } from "react-dom/test-utils";

import { createSyncRoot } from "@foxglove/studio-base/panels/createSyncRoot";

describe("createSyncRoot", () => {
  it("should mount the component", async () => {
    const textTest = "Mount Component Test";
    const TestComponent = () => <div>{textTest}</div>;

    const container = document.createElement("div");
    document.body.appendChild(container);

    act(() => {
      createSyncRoot(<TestComponent />, container);
    });

    expect(await screen.findByText(textTest)).toBeDefined();
  });

  it("should unmount the component", async () => {
    const textTest = "Unmount Component Test";
    const TestComponent = () => <div>{textTest}</div>;

    const container = document.createElement("div");
    document.body.appendChild(container);

    act(() => {
      const unmountCb = createSyncRoot(<TestComponent />, container);
      unmountCb();
    });

    expect(JSON.stringify(await screen.findByText(textTest))).toBe("{}");
  });
});
