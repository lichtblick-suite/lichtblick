/** @jest-environment jsdom */
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

import { act, renderHook } from "@testing-library/react-hooks";
import { mount } from "enzyme";
import { useEffect } from "react";

import Panel from "@foxglove/studio-base/components/Panel";
import { useCurrentLayoutActions } from "@foxglove/studio-base/context/CurrentLayoutContext";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";

type DummyConfig = { someString: string };
type DummyProps = { config: DummyConfig; saveConfig: (arg0: Partial<DummyConfig>) => void };

function getDummyPanel(renderFn: jest.Mock) {
  function DummyComponent(props: DummyProps): ReactNull {
    // Call the mock function in an effect rather than during render, since render may happen more
    // than once due to React.StrictMode.
    useEffect(() => renderFn(props));
    return ReactNull;
  }
  DummyComponent.panelType = "Dummy";
  DummyComponent.defaultConfig = { someString: "hello world" };
  return Panel(DummyComponent);
}

describe("Panel", () => {
  it("renders properly with defaultConfig", () => {
    const renderFn = jest.fn();
    const DummyPanel = getDummyPanel(renderFn);

    mount(
      <PanelSetup>
        <DummyPanel />
      </PanelSetup>,
    );

    expect(renderFn.mock.calls.length).toEqual(1);
    expect(renderFn.mock.calls[0]).toEqual([
      {
        config: { someString: "hello world" },
        saveConfig: expect.any(Function),
      },
    ]);
  });

  it("gets the config from the store", () => {
    const renderFn = jest.fn();
    const DummyPanel = getDummyPanel(renderFn);

    const childId = "Dummy!1my2ydk";
    const someString = "someNewString";

    mount(
      <PanelSetup fixture={{ savedProps: { [childId]: { someString } } }}>
        <DummyPanel childId={childId} />
      </PanelSetup>,
    );

    expect(renderFn.mock.calls).toEqual([
      [
        {
          config: { someString },
          saveConfig: expect.any(Function),
        },
      ],
    ]);
  });

  it("does not rerender when another panel changes", () => {
    const renderFn = jest.fn();
    const DummyPanel = getDummyPanel(renderFn);

    const { result: actions } = renderHook(() => useCurrentLayoutActions(), {
      wrapper({ children }) {
        return (
          <PanelSetup>
            {children}
            <DummyPanel />
          </PanelSetup>
        );
      },
    });

    expect(renderFn.mock.calls.length).toEqual(1);
    act(() => actions.current.savePanelConfigs({ configs: [{ id: "someOtherId", config: {} }] }));
    expect(renderFn.mock.calls.length).toEqual(1);
  });
});
