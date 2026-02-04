/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/* eslint-disable jest/no-done-callback */

import { render } from "@testing-library/react";
import { act } from "react";

import { Condvar, signal } from "@lichtblick/den/async";
import { Time } from "@lichtblick/rostime";
import {
  PanelExtensionContext,
  RenderState,
  MessageEvent,
  Immutable,
  Subscription,
} from "@lichtblick/suite";
import MockPanelContextProvider from "@lichtblick/suite-base/components/MockPanelContextProvider";
import { PLAYER_CAPABILITIES } from "@lichtblick/suite-base/players/constants";
import { AdvertiseOptions } from "@lichtblick/suite-base/players/types";
import PanelSetup, { Fixture } from "@lichtblick/suite-base/stories/PanelSetup";
import ThemeProvider from "@lichtblick/suite-base/theme/ThemeProvider";

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
      // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
      .mockImplementation((cb) => queueMicrotask(() => cb(performance.now())) as any);

    const renderStates: Immutable<RenderState>[] = [];

    const initPanel = jest.fn((context: PanelExtensionContext) => {
      context.watch("currentFrame");
      context.watch("didSeek");
      context.subscribe([{ topic: "x", preload: false }]);
      context.onRender = (renderState, done) => {
        renderStates.push({ ...renderState });
        done();
      };
    });

    const config = {};
    const saveConfig = () => {};

    const message: MessageEvent = {
      topic: "x",
      receiveTime: { sec: 0, nsec: 1 },
      sizeInBytes: 0,
      message: 42,
      schemaName: "foo",
    };

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
    await act(async () => {
      await Promise.resolve();
    });
    wrapper.rerender(<Wrapper lastSeekTime={1} />);
    await act(async () => {
      await Promise.resolve();
    });
    wrapper.rerender(<Wrapper lastSeekTime={2} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(renderStates).toEqual([
      { currentFrame: [], didSeek: false }, // first frame is empty because there are no subscribers yet
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
              capabilities: [PLAYER_CAPABILITIES.advertise],
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
                  expect.arrayContaining<AdvertiseOptions>([
                    {
                      topic: "/some/topic",
                      schemaName: "some_datatype",
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
              capabilities: [PLAYER_CAPABILITIES.advertise],
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
                    // eslint-disable-next-line jest/no-conditional-expect
                    expect.arrayContaining<AdvertiseOptions>([
                      {
                        topic: "/some/topic",
                        schemaName: "some_datatype",
                        options: undefined,
                      },
                    ]),
                  );
                } else if (count === 2) {
                  // eslint-disable-next-line jest/no-conditional-expect
                  expect(advertisements).toEqual(
                    // eslint-disable-next-line jest/no-conditional-expect
                    expect.arrayContaining<AdvertiseOptions>([
                      {
                        topic: "/some/topic",
                        schemaName: "some_datatype",
                        options: undefined,
                      },
                      {
                        topic: "/another/topic",
                        schemaName: "another_datatype",
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
              capabilities: [PLAYER_CAPABILITIES.advertise],
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
                  expect.arrayContaining<AdvertiseOptions>([
                    {
                      topic: "/some/topic",
                      schemaName: "some_datatype",
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
              capabilities: [PLAYER_CAPABILITIES.advertise],
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
                    // eslint-disable-next-line jest/no-conditional-expect
                    expect.arrayContaining<AdvertiseOptions>([
                      {
                        topic: "/some/topic",
                        schemaName: "some_datatype",
                        options: undefined,
                      },
                    ]),
                  );
                } else if (count === 2) {
                  // eslint-disable-next-line jest/no-conditional-expect
                  expect(advertisements).toEqual(
                    // eslint-disable-next-line jest/no-conditional-expect
                    expect.arrayContaining<AdvertiseOptions>([
                      {
                        topic: "/some/topic",
                        schemaName: "some_datatype",
                        options: undefined,
                      },
                      {
                        topic: "/another/topic",
                        schemaName: "another_datatype",
                        options: undefined,
                      },
                    ]),
                  );
                } else if (count === 3) {
                  // eslint-disable-next-line jest/no-conditional-expect
                  expect(advertisements).toEqual(
                    // eslint-disable-next-line jest/no-conditional-expect
                    expect.arrayContaining<AdvertiseOptions>([
                      {
                        topic: "/another/topic",
                        schemaName: "another_datatype",
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
      capabilities: [PLAYER_CAPABILITIES.advertise],
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
            // eslint-disable-next-line jest/no-conditional-expect
            expect.arrayContaining<AdvertiseOptions>([
              {
                topic: "/some/topic",
                schemaName: "some_datatype",
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

      expect(() => {
        context.layout.addPanel({
          position: "foo" as "sibling",
          type: "X",
          updateIfExists: true,
          getState: () => undefined,
        });
      }).toThrow();

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
      context.subscribe([] as Subscription[]);
    };

    const sig = signal();

    render(
      <ThemeProvider isDark>
        <MockPanelContextProvider>
          <PanelSetup
            fixture={{
              capabilities: [PLAYER_CAPABILITIES.advertise],
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
      // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
      .mockImplementation((cb) => queueMicrotask(() => cb(performance.now())) as any);

    let sequence = 0;
    const renderStates: Immutable<RenderState>[] = [];

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
    await act(async () => {
      await Promise.resolve();
    });
    handle.rerender(<Wrapper />);
    await act(async () => {
      await Promise.resolve();
    });
    handle.rerender(<Wrapper />);
    await act(async () => {
      await Promise.resolve();
    });
    handle.rerender(<Wrapper />);
    await act(async () => {
      await Promise.resolve();
    });

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
    const renderStates: Immutable<RenderState>[] = [];

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
    const mockRAF = jest
      .spyOn(window, "requestAnimationFrame")
      // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
      .mockImplementation((cb) => queueMicrotask(() => cb(performance.now())) as any);

    const resumeFrameWait = pauseFrameCond.wait();
    render(<Wrapper currentTime={{ sec: 1, nsec: 0 }} />);
    expect(initPanel).toHaveBeenCalled();

    await act(async () => {
      await resumeFrameWait;
    });

    expect(renderStates).toEqual([
      {
        currentTime: { sec: 1, nsec: 0 },
      },
    ]);

    mockRAF.mockRestore();
  });

  it("ignores subscriptions after panel unmount", async () => {
    const sig = signal();
    const initPanel = jest.fn((context: PanelExtensionContext) => {
      context.watch("currentFrame");
      context.subscribe([{ topic: "x", preload: true }]);
      setTimeout(() => {
        context.subscribe([{ topic: "y", preload: true }]);
        sig.resolve();
      }, 10);
    });

    const config = {};
    const saveConfig = () => {};

    const mockSetSubscriptions = jest.fn();

    const { unmount } = render(
      <ThemeProvider isDark>
        <MockPanelContextProvider>
          <PanelSetup fixture={{ setSubscriptions: mockSetSubscriptions }}>
            <PanelExtensionAdapter config={config} saveConfig={saveConfig} initPanel={initPanel} />
          </PanelSetup>
        </MockPanelContextProvider>
      </ThemeProvider>,
    );

    expect(initPanel).toHaveBeenCalled();

    expect(mockSetSubscriptions.mock.calls).toEqual([
      [expect.any(String), [{ preloadType: "full", topic: "x" }]],
    ]);
    unmount();
    expect(mockSetSubscriptions.mock.calls).toEqual([
      [expect.any(String), [{ preloadType: "full", topic: "x" }]],
      [expect.any(String), []],
    ]);
    await act(async () => {
      await sig;
    });
    unmount();
    expect(mockSetSubscriptions.mock.calls).toEqual([
      [expect.any(String), [{ preloadType: "full", topic: "x" }]],
      [expect.any(String), []],
    ]);
  });

  it("should read metadata correctly", async () => {
    expect.assertions(2);

    const config = {};
    const saveConfig = () => {};

    const sig = signal();

    const initPanel = (context: PanelExtensionContext) => {
      expect(context.metadata).toBeDefined();
      expect(context.metadata).toEqual([
        {
          name: "mockMetadata",
          metadata: { key: "value" },
        },
      ]);
      sig.resolve();
    };

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

    await act(async () => undefined);
    const handle = render(<Wrapper />);

    // force a re-render to make sure we call init panel once
    handle.rerender(<Wrapper />);
    await sig;
  });

  it("should handle unstable_subscribeMessageRange when getBatchIterator returns undefined", async () => {
    const initPanel = (context: PanelExtensionContext) => {
      const cleanup = context.unstable_subscribeMessageRange({
        topic: "/test/topic",
        onNewRangeIterator: async () => {
          // This callback should not be called when no batch iterator is available
          throw new Error("onNewRangeIterator should not be called");
        },
      });
      expect(typeof cleanup).toBe("function");
    };

    const sig = signal();

    render(
      <ThemeProvider isDark>
        <MockPanelContextProvider>
          <PanelSetup>
            <PanelExtensionAdapter config={{}} saveConfig={() => {}} initPanel={initPanel} />
          </PanelSetup>
        </MockPanelContextProvider>
      </ThemeProvider>,
    );

    await act(async () => {
      sig.resolve();
    });
    await sig;
  });

  it("should return cleanup function from unstable_subscribeMessageRange", async () => {
    let cleanupCalled = false;
    const initPanel = (context: PanelExtensionContext) => {
      const cleanup = context.unstable_subscribeMessageRange({
        topic: "/test/topic",
        onNewRangeIterator: async () => {},
      });
      expect(typeof cleanup).toBe("function");

      // Test that cleanup function works
      cleanup();
      cleanupCalled = true;
    };

    const sig = signal();

    render(
      <ThemeProvider isDark>
        <MockPanelContextProvider>
          <PanelSetup>
            <PanelExtensionAdapter config={{}} saveConfig={() => {}} initPanel={initPanel} />
          </PanelSetup>
        </MockPanelContextProvider>
      </ThemeProvider>,
    );

    await act(async () => {
      sig.resolve();
    });
    await sig;

    expect(cleanupCalled).toBe(true);
  });
});
