/** @jest-environment jsdom */

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { mount } from "enzyme";

import { PanelExtensionContext } from "@foxglove/studio";
import MockPanelContextProvider from "@foxglove/studio-base/components/MockPanelContextProvider";
import PanelExtensionAdapter from "@foxglove/studio-base/components/PanelExtensionAdapter";
import { PlayerCapabilities } from "@foxglove/studio-base/players/types";
import PanelSetup, { Fixture } from "@foxglove/studio-base/stories/PanelSetup";
import ThemeProvider from "@foxglove/studio-base/theme/ThemeProvider";

describe("PanelExtensionAdapter", () => {
  it("should call initPanel", (done) => {
    expect.assertions(1);

    const initPanel = (context: PanelExtensionContext) => {
      expect(context).toBeDefined();
      done();
    };

    const config = {};
    const saveConfig = () => {};

    const Wrapper = () => {
      return (
        <ThemeProvider isDark>
          <MockPanelContextProvider>
            <PanelSetup>
              <PanelExtensionAdapter
                config={config}
                saveConfig={saveConfig}
                initPanel={initPanel}
              />
            </PanelSetup>
          </MockPanelContextProvider>
        </ThemeProvider>
      );
    };

    const handle = mount(<Wrapper />);

    // force a re-render to make sure we call init panel once
    handle.setProps({});
  });

  it("should support advertising on a topic", (done) => {
    const initPanel = (context: PanelExtensionContext) => {
      context.advertise?.("/some/topic", "some_datatype");
    };

    mount(
      <ThemeProvider isDark>
        <MockPanelContextProvider>
          <PanelSetup
            fixture={{
              capabilities: [PlayerCapabilities.advertise],
              topics: [],
              datatypes: new Map(),
              frame: {},
              layout: "UnknownPanel!4co6n9d",
              setPublishers: (id, advertisements) => {
                expect(id).toBeDefined();
                expect(advertisements).toEqual(
                  expect.arrayContaining([
                    {
                      topic: "/some/topic",
                      datatype: "some_datatype",
                      options: undefined,
                    },
                  ]),
                );
                done();
              },
            }}
          >
            <PanelExtensionAdapter config={{}} saveConfig={() => {}} initPanel={initPanel} />
          </PanelSetup>
        </MockPanelContextProvider>
      </ThemeProvider>,
    );
  });

  it("should support advertising on multiple topics", (done) => {
    let count = 0;

    const initPanel = (context: PanelExtensionContext) => {
      context.advertise?.("/some/topic", "some_datatype");
      context.advertise?.("/another/topic", "another_datatype");
    };

    mount(
      <ThemeProvider isDark>
        <MockPanelContextProvider>
          <PanelSetup
            fixture={{
              capabilities: [PlayerCapabilities.advertise],
              topics: [],
              datatypes: new Map(),
              frame: {},
              layout: "UnknownPanel!4co6n9d",
              setPublishers: (id, advertisements) => {
                expect(id).toBeDefined();
                ++count;

                if (count === 1) {
                  // eslint-disable-next-line jest/no-conditional-expect
                  expect(advertisements).toEqual(
                    expect.arrayContaining([
                      {
                        topic: "/some/topic",
                        datatype: "some_datatype",
                        options: undefined,
                      },
                    ]),
                  );
                } else if (count === 2) {
                  // eslint-disable-next-line jest/no-conditional-expect
                  expect(advertisements).toEqual(
                    expect.arrayContaining([
                      {
                        topic: "/some/topic",
                        datatype: "some_datatype",
                        options: undefined,
                      },
                      {
                        topic: "/another/topic",
                        datatype: "another_datatype",
                        options: undefined,
                      },
                    ]),
                  );
                  done();
                }
              },
            }}
          >
            <PanelExtensionAdapter config={{}} saveConfig={() => {}} initPanel={initPanel} />
          </PanelSetup>
        </MockPanelContextProvider>
      </ThemeProvider>,
    );
  });

  it("should support publishing on a topic", (done) => {
    expect.assertions(3);

    const initPanel = (context: PanelExtensionContext) => {
      context.advertise?.("/some/topic", "some_datatype");
      context.publish?.("/some/topic", {
        foo: "bar",
      });
    };

    mount(
      <ThemeProvider isDark>
        <MockPanelContextProvider>
          <PanelSetup
            fixture={{
              capabilities: [PlayerCapabilities.advertise],
              topics: [],
              datatypes: new Map(),
              frame: {},
              layout: "UnknownPanel!4co6n9d",
              setPublishers: (id, advertisements) => {
                expect(id).toBeDefined();
                expect(advertisements).toEqual(
                  expect.arrayContaining([
                    {
                      topic: "/some/topic",
                      datatype: "some_datatype",
                      options: undefined,
                    },
                  ]),
                );
              },
              publish: (request) => {
                expect(request).toEqual({ topic: "/some/topic", msg: { foo: "bar" } });
                done();
              },
            }}
          >
            <PanelExtensionAdapter config={{}} saveConfig={() => {}} initPanel={initPanel} />
          </PanelSetup>
        </MockPanelContextProvider>
      </ThemeProvider>,
    );
  });

  it("should support unadvertising", (done) => {
    let count = 0;

    const initPanel = (context: PanelExtensionContext) => {
      context.advertise?.("/some/topic", "some_datatype");
      context.advertise?.("/another/topic", "another_datatype");
      context.unadvertise?.("/some/topic");
    };

    mount(
      <ThemeProvider isDark>
        <MockPanelContextProvider>
          <PanelSetup
            fixture={{
              capabilities: [PlayerCapabilities.advertise],
              topics: [],
              datatypes: new Map(),
              frame: {},
              layout: "UnknownPanel!4co6n9d",
              setPublishers: (id, advertisements) => {
                expect(id).toBeDefined();
                ++count;

                if (count === 1) {
                  // eslint-disable-next-line jest/no-conditional-expect
                  expect(advertisements).toEqual(
                    expect.arrayContaining([
                      {
                        topic: "/some/topic",
                        datatype: "some_datatype",
                        options: undefined,
                      },
                    ]),
                  );
                } else if (count === 2) {
                  // eslint-disable-next-line jest/no-conditional-expect
                  expect(advertisements).toEqual(
                    expect.arrayContaining([
                      {
                        topic: "/some/topic",
                        datatype: "some_datatype",
                        options: undefined,
                      },
                      {
                        topic: "/another/topic",
                        datatype: "another_datatype",
                        options: undefined,
                      },
                    ]),
                  );
                } else if (count === 3) {
                  // eslint-disable-next-line jest/no-conditional-expect
                  expect(advertisements).toEqual(
                    expect.arrayContaining([
                      {
                        topic: "/another/topic",
                        datatype: "another_datatype",
                        options: undefined,
                      },
                    ]),
                  );

                  done();
                }
              },
            }}
          >
            <PanelExtensionAdapter config={{}} saveConfig={() => {}} initPanel={initPanel} />
          </PanelSetup>
        </MockPanelContextProvider>
      </ThemeProvider>,
    );
  });

  it("should unadvertise when unmounting", (done) => {
    expect.assertions(5);
    let count = 0;

    const initPanel = (context: PanelExtensionContext) => {
      expect(context).toBeDefined();
      context.advertise?.("/some/topic", "some_datatype");
    };

    const fixture: Fixture = {
      capabilities: [PlayerCapabilities.advertise],
      topics: [],
      datatypes: new Map(),
      frame: {},
      layout: "UnknownPanel!4co6n9d",
      setPublishers: (id, advertisements) => {
        expect(id).toBeDefined();
        ++count;

        if (count === 1) {
          // eslint-disable-next-line jest/no-conditional-expect
          expect(advertisements).toEqual(
            expect.arrayContaining([
              {
                topic: "/some/topic",
                datatype: "some_datatype",
                options: undefined,
              },
            ]),
          );
        } else if (count === 2) {
          // eslint-disable-next-line jest/no-conditional-expect
          expect(advertisements).toEqual(expect.arrayContaining([]));
          done();
        }
      },
    };

    const config = {};
    const saveConfig = () => {};

    const Wrapper = ({ mounted = true }: { mounted?: boolean }) => {
      return (
        <ThemeProvider isDark>
          <MockPanelContextProvider>
            <PanelSetup fixture={fixture}>
              {mounted && (
                <PanelExtensionAdapter
                  config={config}
                  saveConfig={saveConfig}
                  initPanel={initPanel}
                />
              )}
            </PanelSetup>
          </MockPanelContextProvider>
        </ThemeProvider>
      );
    };

    const handle = mount(<Wrapper mounted />);
    handle.setProps({ mounted: false });
  });

  it("supports adding new panels to the layout", (done) => {
    expect.assertions(3);

    const openSiblingPanel = jest.fn();
    const config = {};
    const saveConfig = () => {};

    const initPanel = (context: PanelExtensionContext) => {
      expect(context).toBeDefined();

      expect(() =>
        context.layout.addPanel({
          position: "foo" as "sibling",
          type: "X",
          updateIfExists: true,
          getState: () => undefined,
        }),
      ).toThrow();

      context.layout.addPanel({
        position: "sibling",
        type: "X",
        updateIfExists: true,
        getState: () => undefined,
      });
      expect(openSiblingPanel.mock.calls).toEqual([
        [{ panelType: "X", updateIfExists: true, siblingConfigCreator: expect.any(Function) }],
      ]);
      done();
    };

    const Wrapper = () => {
      return (
        <ThemeProvider isDark>
          <MockPanelContextProvider openSiblingPanel={openSiblingPanel}>
            <PanelSetup>
              <PanelExtensionAdapter
                config={config}
                saveConfig={saveConfig}
                initPanel={initPanel}
              />
            </PanelSetup>
          </MockPanelContextProvider>
        </ThemeProvider>
      );
    };

    const handle = mount(<Wrapper />);

    // force a re-render to make sure we call init panel once
    handle.setProps({});
  });
});
