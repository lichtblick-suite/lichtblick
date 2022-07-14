/** @jest-environment jsdom */
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { mount } from "enzyme";

import ThemeProvider from "@foxglove/studio-base/theme/ThemeProvider";

import ShareJsonModal from "./ShareJsonModal";

describe("<ShareJsonModal />", () => {
  it("fires change callback with new valid json contents", (done) => {
    const pass = (value: any) => {
      expect(value).toEqual({ id: "foo" });
      done();
    };
    const wrapper = mount(
      <ThemeProvider isDark>
        <div data-modalcontainer="true">
          <ShareJsonModal
            title="Foo"
            onRequestClose={() => {
              // no-op
            }}
            initialValue={{}}
            onChange={pass}
            noun="layout"
          />
        </div>
      </ThemeProvider>,
    );

    const value = JSON.stringify({ id: "foo" });

    wrapper.find("textarea").first().simulate("change", { target: { value } });
    wrapper.find(".MuiButton-root.MuiButton-containedPrimary").first().simulate("click");

    expect(wrapper.find(".MuiFormHelperText-root.Mui-error").exists()).toBe(false);
  });

  it("fires no change callback and shows error if bad input is used", (done) => {
    const fail = () => {
      done("Change callback was fired unexpectedly");
    };
    const wrapper = mount(
      <ThemeProvider isDark>
        <div data-modalcontainer="true">
          <ShareJsonModal
            title="Foo"
            onRequestClose={() => {
              // no-op
            }}
            initialValue={{}}
            onChange={fail}
            noun="layout"
          />
        </div>
      </ThemeProvider>,
    );
    const value = "asdlkfjasdf:";

    wrapper.find("textarea").first().simulate("change", { target: { value } });
    wrapper.find(".MuiButton-root.MuiButton-containedPrimary").first().simulate("click");

    expect(wrapper.find(".MuiFormHelperText-root.Mui-error").exists()).toBe(true);
    done();
  });

  it("fires no error when resetting an actual layout to default", (done) => {
    const pass = (value: any) => {
      expect(value.layout).toEqual("RosOut!cuuf9u");
      done();
    };
    const wrapper = mount(
      <ThemeProvider isDark>
        <div data-modalcontainer="true">
          <ShareJsonModal
            title="Foo"
            onRequestClose={() => {
              // no-op
            }}
            initialValue={{}}
            onChange={pass}
            noun="layout"
          />
        </div>
      </ThemeProvider>,
    );
    const value = JSON.stringify({
      layout: "RosOut!cuuf9u",
      savedProps: {},
      globalVariables: {},
    });
    wrapper.find("textarea").first().simulate("change", { target: { value } });
    wrapper.find(".MuiButton-root.MuiButton-containedPrimary").first().simulate("click");

    expect(wrapper.find(".MuiFormHelperText-root.Mui-error").exists()).toBe(false);
  });
});
