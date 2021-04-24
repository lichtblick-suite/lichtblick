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

import { mount } from "enzyme";

import ThemeProvider from "@foxglove-studio/app/theme/ThemeProvider";

import ShareJsonModal from "./ShareJsonModal";

describe("<ShareJsonModal />", () => {
  it("fires change callback with new valid json contents", (done) => {
    const pass = (value: any) => {
      expect(value).toEqual({ id: "foo" });
      done();
    };
    const wrapper = mount(
      <ThemeProvider>
        <div data-modalcontainer="true">
          <ShareJsonModal
            onRequestClose={() => {
              // no-op
            }}
            value={{}}
            onChange={pass}
            noun="layout"
          />
        </div>
      </ThemeProvider>,
    );
    const newValue = btoa(JSON.stringify({ id: "foo" }));
    wrapper.find(".textarea").simulate("change", { target: { value: newValue } });
    wrapper.find("Button[children='Apply']").first().simulate("click");
    expect(wrapper.find(".is-danger").exists()).toBe(false);
  });

  it("fires no change callback and shows error if bad input is used", (done) => {
    const fail = () => {
      done("Change callback was fired unexpectedly");
    };
    const wrapper = mount(
      <ThemeProvider>
        <div data-modalcontainer="true">
          <ShareJsonModal
            onRequestClose={() => {
              // no-op
            }}
            value={{}}
            onChange={fail}
            noun="layout"
          />
        </div>
      </ThemeProvider>,
    );
    const newValue = "asdlkfjasdf";
    wrapper.find(".textarea").simulate("change", { target: { value: newValue } });
    wrapper.find("Button[children='Apply']").first().simulate("click");
    expect(wrapper.find(".is-danger").exists()).toBe(true);
    done();
  });

  it("fires no error when resetting an actual layout to default", (done) => {
    const pass = (value: any) => {
      expect(value.layout).toEqual("RosOut!cuuf9u");
      done();
    };
    const wrapper = mount(
      <ThemeProvider>
        <div data-modalcontainer="true">
          <ShareJsonModal
            onRequestClose={() => {
              // no-op
            }}
            value={{}}
            onChange={pass}
            noun="layout"
          />
        </div>
      </ThemeProvider>,
    );
    const newValue = btoa(
      JSON.stringify({
        layout: "RosOut!cuuf9u",
        savedProps: {},
        globalVariables: {},
      }),
    );
    wrapper.find(".textarea").simulate("change", { target: { value: newValue } });
    wrapper.find("Button[children='Apply']").first().simulate("click");
    expect(wrapper.find(".is-danger").exists()).toBe(false);
  });
});
