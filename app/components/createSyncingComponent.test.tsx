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

import createSyncingComponent from "@foxglove-studio/app/components/createSyncingComponent";
import delay from "@foxglove-studio/app/shared/delay";
import tick from "@foxglove-studio/app/shared/tick";

describe("createSyncingComponent", () => {
  const IdentitySyncingComponent = createSyncingComponent(
    "IdentitySyncingComponent",
    (dataItems) => dataItems,
  );

  // since all tests use the same syncing component, allow time to ensure everything has updated
  // after unmounting at the end of each test
  afterEach(async () => {
    await tick();
  });

  it("returns data that was passed in to just the component itself", async () => {
    const childFn = jest.fn().mockReturnValue(null);
    const wrapper = mount(
      <IdentitySyncingComponent data={{ some: "data" }}>{childFn}</IdentitySyncingComponent>,
    );
    await tick();
    expect(childFn.mock.calls).toEqual([[[{ some: "data" }]]]);
    wrapper.unmount();
  });

  it("cleans up data after unmounting", async () => {
    const wrapper1 = mount(
      <IdentitySyncingComponent data={{ component: 1 }}>{() => null}</IdentitySyncingComponent>,
    );
    await tick();
    wrapper1.unmount();
    await tick();

    const childFn = jest.fn().mockReturnValue(null);
    const wrapper2 = mount(
      <IdentitySyncingComponent data={{ component: 2 }}>{childFn}</IdentitySyncingComponent>,
    );
    await tick();
    expect(childFn.mock.calls).toEqual([[[{ component: 2 }]]]);
    wrapper2.unmount();
  });

  it("returns data passed to other components as well", async () => {
    const wrapper1 = mount(
      <IdentitySyncingComponent data={{ component: 1 }}>{() => null}</IdentitySyncingComponent>,
    );
    await tick();

    const childFn = jest.fn().mockReturnValue(null);
    const wrapper2 = mount(
      <IdentitySyncingComponent data={{ component: 2 }}>{childFn}</IdentitySyncingComponent>,
    );
    await tick();
    expect(childFn.mock.calls).toEqual([[[{ component: 1 }, { component: 2 }]]]);

    wrapper1.unmount();
    wrapper2.unmount();
  });

  it("rerenders other components when changing data", async () => {
    const childFn1 = jest.fn().mockReturnValue(null);
    const wrapper1 = mount(
      <IdentitySyncingComponent data={{ component: 1 }}>{childFn1}</IdentitySyncingComponent>,
    );
    await tick();

    const childFn2 = jest.fn().mockReturnValue(null);
    const wrapper2 = mount(
      <IdentitySyncingComponent data={{ component: 2 }}>{childFn2}</IdentitySyncingComponent>,
    );
    await tick();

    wrapper1.setProps({ data: { component: 1, different: "data" } });
    await delay(1000);

    expect(childFn1.mock.calls).toEqual([
      [[{ component: 1 }]],
      [[{ component: 1, different: "data" }, { component: 2 }]],
    ]);
    expect(childFn2.mock.calls).toEqual([
      [[{ component: 1 }, { component: 2 }]],
      [[{ component: 1, different: "data" }, { component: 2 }]],
    ]);

    wrapper1.unmount();
    wrapper2.unmount();
  });
});
