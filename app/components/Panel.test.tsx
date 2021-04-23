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

import { mount } from "enzyme";
import { createMemoryHistory } from "history";
import { useEffect } from "react";

import { savePanelConfigs } from "@foxglove-studio/app/actions/panels";
import Panel from "@foxglove-studio/app/components/Panel";
import createRootReducer from "@foxglove-studio/app/reducers";
import configureStore from "@foxglove-studio/app/store/configureStore.testing";
import PanelSetup from "@foxglove-studio/app/stories/PanelSetup";

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

function getStore() {
  return configureStore(createRootReducer(createMemoryHistory()));
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

    const store = getStore();
    store.dispatch(savePanelConfigs({ configs: [{ id: childId, config: { someString } }] }));
    mount(
      <PanelSetup store={store}>
        <DummyPanel childId={childId} />
      </PanelSetup>,
    );

    expect(renderFn.mock.calls.length).toEqual(1);
    expect(renderFn.mock.calls[0]).toEqual([
      {
        config: { someString },
        saveConfig: expect.any(Function),
      },
    ]);
  });

  it("does not rerender when another panel changes", () => {
    const renderFn = jest.fn();
    const DummyPanel = getDummyPanel(renderFn);

    const store = getStore();
    mount(
      <PanelSetup store={store}>
        <DummyPanel />
      </PanelSetup>,
    );

    expect(renderFn.mock.calls.length).toEqual(1);
    store.dispatch(savePanelConfigs({ configs: [{ id: "someOtherId", config: {} }] }));
    expect(renderFn.mock.calls.length).toEqual(1);
  });
});
