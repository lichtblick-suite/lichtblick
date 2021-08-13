/** @jest-environment jsdom */

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { mount } from "enzyme";

import { PanelExtensionContext } from "@foxglove/studio";
import PanelExtensionAdapter from "@foxglove/studio-base/components/PanelExtensionAdapter";
import { HoverValueProvider } from "@foxglove/studio-base/context/HoverValueContext";
import PanelSetup, { Fixture } from "@foxglove/studio-base/stories/PanelSetup";

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
        <HoverValueProvider>
          <PanelSetup>
            <PanelExtensionAdapter config={config} saveConfig={saveConfig} initPanel={initPanel} />
          </PanelSetup>
        </HoverValueProvider>
      );
    };

    const handle = mount(<Wrapper />);

    // force a re-render to make sure we call init panel once
    handle.setProps({});
  });

  it("should support advertising on a topic", (done) => {
    const initPanel = (context: PanelExtensionContext) => {
      context.advertise("/some/topic", "some_datatype");
    };

    mount(
      <HoverValueProvider>
        <PanelSetup
          fixture={{
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
      </HoverValueProvider>,
    );
  });

  it("should support advertising on multiple topics", (done) => {
    let count = 0;

    const initPanel = (context: PanelExtensionContext) => {
      context.advertise("/some/topic", "some_datatype");
      context.advertise("/another/topic", "another_datatype");
    };

    mount(
      <HoverValueProvider>
        <PanelSetup
          fixture={{
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
      </HoverValueProvider>,
    );
  });

  it("should support publishing on a topic", (done) => {
    expect.assertions(3);

    const initPanel = (context: PanelExtensionContext) => {
      context.advertise("/some/topic", "some_datatype");
      context.publish("/some/topic", {
        foo: "bar",
      });
    };

    mount(
      <HoverValueProvider>
        <PanelSetup
          fixture={{
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
      </HoverValueProvider>,
    );
  });

  it("should support unadvertising", (done) => {
    let count = 0;

    const initPanel = (context: PanelExtensionContext) => {
      context.advertise("/some/topic", "some_datatype");
      context.advertise("/another/topic", "another_datatype");
      context.unadvertise("/some/topic");
    };

    mount(
      <HoverValueProvider>
        <PanelSetup
          fixture={{
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
      </HoverValueProvider>,
    );
  });

  it("should unadvertise when unmounting", (done) => {
    expect.assertions(5);
    let count = 0;

    const initPanel = (context: PanelExtensionContext) => {
      expect(context).toBeDefined();
      context.advertise("/some/topic", "some_datatype");
    };

    const fixture: Fixture = {
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
        <HoverValueProvider>
          <PanelSetup fixture={fixture}>
            {mounted && (
              <PanelExtensionAdapter
                config={config}
                saveConfig={saveConfig}
                initPanel={initPanel}
              />
            )}
          </PanelSetup>
        </HoverValueProvider>
      );
    };

    const handle = mount(<Wrapper mounted />);
    handle.setProps({ mounted: false });
  });
});
