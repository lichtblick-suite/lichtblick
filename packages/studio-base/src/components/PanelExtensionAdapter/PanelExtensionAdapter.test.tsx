/** @jest-environment jsdom */

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/* eslint-disable jest/no-done-callback */

import { render } from "@testing-library/react";
import { act } from "react-dom/test-utils";

import { Condvar, signal } from "@foxglove/den/async";
import { Time } from "@foxglove/rostime";
import { PanelExtensionContext, RenderState } from "@foxglove/studio";
import MockPanelContextProvider from "@foxglove/studio-base/components/MockPanelContextProvider";
import { PlayerCapabilities } from "@foxglove/studio-base/players/types";
import PanelSetup, { Fixture } from "@foxglove/studio-base/stories/PanelSetup";
import ThemeProvider from "@foxglove/studio-base/theme/ThemeProvider";

import PanelExtensionAdapter from "./PanelExtensionAdapter";

describe("PanelExtensionAdapter", () => {
  it("should call initPanel", async () => {
    expect.assertions(1);

    const sig = signal();
    const initPanel = (context: PanelExtensionContext) => {
      expect(context).toBeDefined();
      sig.resolve();
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

    const handle = render(<Wrapper />);
    await act(async () => undefined);

    // force a re-render to make sure we do not call init panel again
    handle.rerender(<Wrapper />);
    await sig;
  });

  it("sets didSeek=true when seeking", async () => {
    const mockRAF = jest
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((cb) => queueMicrotask(() => cb(performance.now())) as any);

    const renderStates: RenderState[] = [];

    const initPanel = jest.fn((context: PanelExtensionContext) => {
      context.watch("currentFrame");
      context.watch("didSeek");
      context.subscribe(["x"]);
      context.onRender = (renderState, done) => {
        renderStates.push({ ...renderState });
        done();
      };
    });

    const config = {};
    const saveConfig = () => {};

    const message = { topic: "x", receiveTime: { sec: 0, nsec: 1 }, sizeInBytes: 0, message: 42 };

    const Wrapper = ({ lastSeekTime }: { lastSeekTime?: number }) => {
      return (
        <ThemeProvider isDark>
          <MockPanelContextProvider>
            <PanelSetup
              fixture={{
                activeData: { lastSeekTime },
                frame: {
                  x: [message],
                },
              }}
            >
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

    const wrapper = render(<Wrapper lastSeekTime={undefined} />);
    expect(initPanel).toHaveBeenCalled();

    wrapper.rerender(<Wrapper lastSeekTime={1} />);
    await act(async () => await Promise.resolve());
    wrapper.rerender(<Wrapper lastSeekTime={1} />);
    await act(async () => await Promise.resolve());
    wrapper.rerender(<Wrapper lastSeekTime={2} />);
    await act(async () => await Promise.resolve());
    expect(renderStates).toEqual([
      { currentFrame: [message], didSeek: false },
      { currentFrame: [message], didSeek: true },
      { currentFrame: [message], didSeek: false },
      { currentFrame: [message], didSeek: true },
    ]);
    mockRAF.mockRestore();
  });

  it("should support advertising on a topic", async () => {
    const initPanel = (context: PanelExtensionContext) => {
      context.advertise?.("/some/topic", "some_datatype");
    };

    const sig = signal();
    let passed = false;
    render(
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
                if (passed) {
                  return;
                }
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
                passed = true;
                sig.resolve();
              },
            }}
          >
            <PanelExtensionAdapter config={{}} saveConfig={() => {}} initPanel={initPanel} />
          </PanelSetup>
        </MockPanelContextProvider>
      </ThemeProvider>,
    );
    await act(async () => undefined);
    await sig;
  });

  it("should support advertising on multiple topics", async () => {
    let count = 0;

    const initPanel = (context: PanelExtensionContext) => {
      context.advertise?.("/some/topic", "some_datatype");
      context.advertise?.("/another/topic", "another_datatype");
    };
    const sig = signal();

    render(
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
                  sig.resolve();
                }
              },
            }}
          >
            <PanelExtensionAdapter config={{}} saveConfig={() => {}} initPanel={initPanel} />
          </PanelSetup>
        </MockPanelContextProvider>
      </ThemeProvider>,
    );

    await act(async () => undefined);
    await sig;
  });

  it("should support publishing on a topic", async () => {
    expect.assertions(3);

    const initPanel = (context: PanelExtensionContext) => {
      context.advertise?.("/some/topic", "some_datatype");
      context.publish?.("/some/topic", {
        foo: "bar",
      });
    };

    const sig = signal();
    let passed = false;
    render(
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
                if (passed) {
                  return;
                }
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
                if (passed) {
                  return;
                }
                expect(request).toEqual({ topic: "/some/topic", msg: { foo: "bar" } });
                passed = true;
                sig.resolve();
              },
            }}
          >
            <PanelExtensionAdapter config={{}} saveConfig={() => {}} initPanel={initPanel} />
          </PanelSetup>
        </MockPanelContextProvider>
      </ThemeProvider>,
    );

    await act(async () => undefined);
    await sig;
  });

  it("should support unadvertising", async () => {
    let count = 0;

    const initPanel = (context: PanelExtensionContext) => {
      context.advertise?.("/some/topic", "some_datatype");
      context.advertise?.("/another/topic", "another_datatype");
      context.unadvertise?.("/some/topic");
    };

    const sig = signal();

    render(
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

                  sig.resolve();
                }
              },
            }}
          >
            <PanelExtensionAdapter config={{}} saveConfig={() => {}} initPanel={initPanel} />
          </PanelSetup>
        </MockPanelContextProvider>
      </ThemeProvider>,
    );

    await act(async () => undefined);
    await sig;
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

    const handle = render(<Wrapper mounted />);
    handle.rerender(<Wrapper mounted={false} />);
  });

  it("supports adding new panels to the layout", async () => {
    expect.assertions(3);

    const openSiblingPanel = jest.fn();
    const config = {};
    const saveConfig = () => {};

    const sig = signal();

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
      sig.resolve();
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

    const handle = render(<Wrapper />);

    await act(async () => undefined);

    // force a re-render to make sure we call init panel once
    handle.rerender(<Wrapper />);
    await sig;
  });

  it("should unsubscribe from all topics when subscribing to empty topics array", async () => {
    const initPanel = (context: PanelExtensionContext) => {
      context.subscribe([]);
    };

    const sig = signal();

    render(
      <ThemeProvider isDark>
        <MockPanelContextProvider>
          <PanelSetup
            fixture={{
              capabilities: [PlayerCapabilities.advertise],
              topics: [],
              datatypes: new Map(),
              frame: {},
              layout: "UnknownPanel!4co6n9d",
              setSubscriptions: (_, payload) => {
                expect(payload).toEqual([]);
                sig.resolve();
              },
            }}
          >
            <PanelExtensionAdapter config={{}} saveConfig={() => {}} initPanel={initPanel} />
          </PanelSetup>
        </MockPanelContextProvider>
      </ThemeProvider>,
    );

    await act(async () => undefined);
    await sig;
  });

  it("should get and set variables", async () => {
    const mockRAF = jest
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((cb) => queueMicrotask(() => cb(performance.now())) as any);

    let sequence = 0;
    const renderStates: RenderState[] = [];

    const initPanel = jest.fn((context: PanelExtensionContext) => {
      context.watch("variables");
      context.onRender = (renderState, done) => {
        renderStates.push({ ...renderState });
        if (sequence === 0) {
          context.setVariable("foo", "bar");
        } else if (sequence === 1) {
          context.setVariable("foo", true);
        } else if (sequence === 2) {
          context.setVariable("foo", { nested: [1, 2, 3] });
        } else if (sequence === 3) {
          context.setVariable("foo", undefined);
        }
        sequence++;
        done();
      };
    });

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

    const handle = render(<Wrapper />);

    handle.rerender(<Wrapper />);
    await act(async () => await Promise.resolve());
    handle.rerender(<Wrapper />);
    await act(async () => await Promise.resolve());
    handle.rerender(<Wrapper />);
    await act(async () => await Promise.resolve());
    handle.rerender(<Wrapper />);
    await act(async () => await Promise.resolve());

    expect(renderStates).toEqual([
      { variables: new Map() },
      { variables: new Map([["foo", "bar"]]) },
      { variables: new Map([["foo", true]]) },
      { variables: new Map([["foo", { nested: [1, 2, 3] }]]) },
      { variables: new Map() },
    ]);
    mockRAF.mockRestore();
  });

  it("should call pause frame with new frame and resume after rendering", async () => {
    const renderStates: RenderState[] = [];

    const initPanel = jest.fn((context: PanelExtensionContext) => {
      context.watch("currentTime");
      context.onRender = (renderState, done) => {
        renderStates.push({ ...renderState });
        done();
      };
    });

    const config = {};
    const saveConfig = () => {};

    const pauseFrameCond = new Condvar();

    const Wrapper = ({ currentTime }: { currentTime?: Time }) => {
      return (
        <ThemeProvider isDark>
          <MockPanelContextProvider>
            <PanelSetup
              fixture={{
                activeData: { currentTime },
              }}
              pauseFrame={() => {
                return () => {
                  pauseFrameCond.notifyAll();
                };
              }}
            >
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

    // Setup the request animation frame to take some time
    const mockRAF = jest.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      queueMicrotask(() => cb(performance.now())) as any;
      return 1;
    });

    const resumeFrameWait = pauseFrameCond.wait();
    render(<Wrapper currentTime={{ sec: 1, nsec: 0 }} />);
    expect(initPanel).toHaveBeenCalled();

    await act(async () => await resumeFrameWait);

    expect(renderStates).toEqual([
      {
        currentTime: { sec: 1, nsec: 0 },
      },
    ]);

    mockRAF.mockRestore();
  });
});
