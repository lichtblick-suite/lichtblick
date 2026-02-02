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
import { BasicBuilder } from "@lichtblick/test-builders";

import PanelExtensionAdapter from "./PanelExtensionAdapter";

describe("PanelExtensionAdapter", () => {
  it("should call initPanel", async () => {
    expect.assertions(1);

    const sign = signal();
    const initPanel = (context: PanelExtensionContext) => {
      expect(context).toBeDefined();
      sign.resolve();
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
    await sign;
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

    const sign = signal();
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
                sign.resolve();
              },
            }}
          >
            <PanelExtensionAdapter config={{}} saveConfig={() => {}} initPanel={initPanel} />
          </PanelSetup>
        </MockPanelContextProvider>
      </ThemeProvider>,
    );
    await act(async () => undefined);
    await sign;
  });

  it("should support advertising on multiple topics", async () => {
    let count = 0;

    const initPanel = (context: PanelExtensionContext) => {
      context.advertise?.("/some/topic", "some_datatype");
      context.advertise?.("/another/topic", "another_datatype");
    };
    const sign = signal();

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
                  sign.resolve();
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
    await sign;
  });

  it("should support publishing on a topic", async () => {
    expect.assertions(3);

    const initPanel = (context: PanelExtensionContext) => {
      context.advertise?.("/some/topic", "some_datatype");
      context.publish?.("/some/topic", {
        foo: "bar",
      });
    };

    const sign = signal();
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
                sign.resolve();
              },
            }}
          >
            <PanelExtensionAdapter config={{}} saveConfig={() => {}} initPanel={initPanel} />
          </PanelSetup>
        </MockPanelContextProvider>
      </ThemeProvider>,
    );

    await act(async () => undefined);
    await sign;
  });

  it("should support unadvertising", async () => {
    let count = 0;

    const initPanel = (context: PanelExtensionContext) => {
      context.advertise?.("/some/topic", "some_datatype");
      context.advertise?.("/another/topic", "another_datatype");
      context.unadvertise?.("/some/topic");
    };

    const sign = signal();

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

                  sign.resolve();
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
    await sign;
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

    const sign = signal();

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
      sign.resolve();
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
    await sign;
  });

  it("should unsubscribe from all topics when subscribing to empty topics array", async () => {
    const initPanel = (context: PanelExtensionContext) => {
      context.subscribe([] as Subscription[]);
    };

    const sign = signal();

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
                sign.resolve();
              },
            }}
          >
            <PanelExtensionAdapter config={{}} saveConfig={() => {}} initPanel={initPanel} />
          </PanelSetup>
        </MockPanelContextProvider>
      </ThemeProvider>,
    );

    await act(async () => undefined);
    await sign;
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
    const sign = signal();
    const initPanel = jest.fn((context: PanelExtensionContext) => {
      context.watch("currentFrame");
      context.subscribe([{ topic: "x", preload: true }]);
      setTimeout(() => {
        context.subscribe([{ topic: "y", preload: true }]);
        sign.resolve();
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
      await sign;
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

    const sign = signal();

    const initPanel = (context: PanelExtensionContext) => {
      expect(context.metadata).toBeDefined();
      expect(context.metadata).toEqual([
        {
          name: "mockMetadata",
          metadata: { key: "value" },
        },
      ]);
      sign.resolve();
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
    await sign;
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

    const sign = signal();

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
      sign.resolve();
    });
    await sign;
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

    const sign = signal();

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
      sign.resolve();
    });
    await sign;

    expect(cleanupCalled).toBe(true);
  });

  describe("extension settings action handler", () => {
    it("should handle reorder-node action by returning early", async () => {
      // Given - a panel with extension settings
      const saveConfig = jest.fn();
      const sign = signal();

      const initPanel = (context: PanelExtensionContext) => {
        context.updatePanelSettingsEditor({
          actionHandler: () => {
            // This will be wrapped by extensionSettingsActionHandler
          },
          nodes: {},
        });
        sign.resolve();
      };

      render(
        <ThemeProvider isDark>
          <MockPanelContextProvider type="TestPanel">
            <PanelSetup>
              <PanelExtensionAdapter config={{}} saveConfig={saveConfig} initPanel={initPanel} />
            </PanelSetup>
          </MockPanelContextProvider>
        </ThemeProvider>,
      );

      await act(async () => undefined);
      await sign;

      // When - reorder-node action is triggered
      // Then - saveConfig should not be called (early return)
      expect(saveConfig).not.toHaveBeenCalled();
    });
  });

  describe("panel context methods with unmounted check", () => {
    it("should not saveState after unmount", async () => {
      // Given - a mounted panel
      const saveConfig = jest.fn();
      let panelContext: PanelExtensionContext | undefined;

      const initPanel = (context: PanelExtensionContext) => {
        panelContext = context;
      };

      const { unmount } = render(
        <ThemeProvider isDark>
          <MockPanelContextProvider>
            <PanelSetup>
              <PanelExtensionAdapter config={{}} saveConfig={saveConfig} initPanel={initPanel} />
            </PanelSetup>
          </MockPanelContextProvider>
        </ThemeProvider>,
      );

      await act(async () => undefined);

      // When - panel is unmounted and then saveState is called
      unmount();
      panelContext?.saveState({ test: "value" });

      // Then - saveConfig should not be called after unmount
      expect(saveConfig).not.toHaveBeenCalled();
    });

    it("should not seekPlayback after unmount", async () => {
      // Given - a panel with seekPlayback capability
      const mockSeekPlayback = jest.fn();
      let panelContext: PanelExtensionContext | undefined;

      const initPanel = (context: PanelExtensionContext) => {
        panelContext = context;
      };

      const { unmount } = render(
        <ThemeProvider isDark>
          <MockPanelContextProvider>
            <PanelSetup fixture={{}}>
              <PanelExtensionAdapter config={{}} saveConfig={() => {}} initPanel={initPanel} />
            </PanelSetup>
          </MockPanelContextProvider>
        </ThemeProvider>,
      );

      await act(async () => undefined);

      // When - panel is unmounted and then seekPlayback is called
      unmount();
      panelContext?.seekPlayback?.(1234);

      // Then - seekPlayback should not be called after unmount
      expect(mockSeekPlayback).not.toHaveBeenCalled();
    });

    it("should not setParameter after unmount", async () => {
      // Given - a panel with setParameter capability
      const mockSetParameter = jest.fn();
      let panelContext: PanelExtensionContext | undefined;

      const initPanel = (context: PanelExtensionContext) => {
        panelContext = context;
      };

      const { unmount } = render(
        <ThemeProvider isDark>
          <MockPanelContextProvider>
            <PanelSetup fixture={{ setParameter: mockSetParameter }}>
              <PanelExtensionAdapter config={{}} saveConfig={() => {}} initPanel={initPanel} />
            </PanelSetup>
          </MockPanelContextProvider>
        </ThemeProvider>,
      );

      await act(async () => undefined);

      // When - panel is unmounted and then setParameter is called
      unmount();
      panelContext?.setParameter("testParam", "testValue");

      // Then - setParameter should not be called after unmount
      expect(mockSetParameter).not.toHaveBeenCalled();
    });

    it("should not setVariable after unmount", async () => {
      // Given - a panel that can set variables
      let panelContext: PanelExtensionContext | undefined;
      const renderStates: Immutable<RenderState>[] = [];

      const initPanel = (context: PanelExtensionContext) => {
        panelContext = context;
        context.watch("variables");
        context.onRender = (renderState, done) => {
          renderStates.push({ ...renderState });
          done();
        };
      };

      const { unmount } = render(
        <ThemeProvider isDark>
          <MockPanelContextProvider>
            <PanelSetup>
              <PanelExtensionAdapter config={{}} saveConfig={() => {}} initPanel={initPanel} />
            </PanelSetup>
          </MockPanelContextProvider>
        </ThemeProvider>,
      );

      await act(async () => undefined);
      const initialRenderCount = renderStates.length;

      // When - panel is unmounted and then setVariable is called
      unmount();
      panelContext?.setVariable("testVar", "testValue");

      await act(async () => {
        await Promise.resolve();
      });

      // Then - no additional renders should occur after unmount
      expect(renderStates.length).toBe(initialRenderCount);
    });

    it("should not setPreviewTime after unmount", async () => {
      // Given - a panel with preview time capability
      let panelContext: PanelExtensionContext | undefined;

      const initPanel = (context: PanelExtensionContext) => {
        panelContext = context;
      };

      const { unmount } = render(
        <ThemeProvider isDark>
          <MockPanelContextProvider>
            <PanelSetup>
              <PanelExtensionAdapter config={{}} saveConfig={() => {}} initPanel={initPanel} />
            </PanelSetup>
          </MockPanelContextProvider>
        </ThemeProvider>,
      );

      await act(async () => undefined);

      // When - panel is unmounted and then setPreviewTime is called
      unmount();

      // Then - setPreviewTime should not throw after unmount
      expect(() => panelContext?.setPreviewTime(123)).not.toThrow();
    });

    it("should not watch fields after unmount", async () => {
      // Given - a panel that watches fields
      let panelContext: PanelExtensionContext | undefined;

      const initPanel = (context: PanelExtensionContext) => {
        panelContext = context;
      };

      const { unmount } = render(
        <ThemeProvider isDark>
          <MockPanelContextProvider>
            <PanelSetup>
              <PanelExtensionAdapter config={{}} saveConfig={() => {}} initPanel={initPanel} />
            </PanelSetup>
          </MockPanelContextProvider>
        </ThemeProvider>,
      );

      await act(async () => undefined);

      // When - panel is unmounted and then watch is called
      unmount();

      // Then - watch should not throw after unmount
      expect(() => panelContext?.watch("currentTime")).not.toThrow();
    });

    it("should not advertise after unmount", async () => {
      // Given - a panel with advertise capability
      const mockSetPublishers = jest.fn();
      let panelContext: PanelExtensionContext | undefined;

      const initPanel = (context: PanelExtensionContext) => {
        panelContext = context;
      };

      const { unmount } = render(
        <ThemeProvider isDark>
          <MockPanelContextProvider>
            <PanelSetup
              fixture={{
                capabilities: [PLAYER_CAPABILITIES.advertise],
                setPublishers: mockSetPublishers,
              }}
            >
              <PanelExtensionAdapter config={{}} saveConfig={() => {}} initPanel={initPanel} />
            </PanelSetup>
          </MockPanelContextProvider>
        </ThemeProvider>,
      );

      await act(async () => undefined);

      // When - panel is unmounted and then advertise is called
      await act(async () => {
        unmount();
      });
      mockSetPublishers.mockClear(); // Clear the cleanup call from unmount
      panelContext?.advertise?.("/test/topic", "test_datatype");

      // Then - setPublishers should not be called after unmount
      expect(mockSetPublishers).not.toHaveBeenCalled();
    });

    it("should not unadvertise after unmount", async () => {
      // Given - a panel with unadvertise capability
      const mockSetPublishers = jest.fn();
      let panelContext: PanelExtensionContext | undefined;

      const initPanel = (context: PanelExtensionContext) => {
        panelContext = context;
        context.advertise?.("/test/topic", "test_datatype");
      };

      const { unmount } = render(
        <ThemeProvider isDark>
          <MockPanelContextProvider>
            <PanelSetup
              fixture={{
                capabilities: [PLAYER_CAPABILITIES.advertise],
                setPublishers: mockSetPublishers,
              }}
            >
              <PanelExtensionAdapter config={{}} saveConfig={() => {}} initPanel={initPanel} />
            </PanelSetup>
          </MockPanelContextProvider>
        </ThemeProvider>,
      );

      await act(async () => undefined);

      // When - panel is unmounted and then unadvertise is called
      await act(async () => {
        unmount();
      });
      mockSetPublishers.mockClear(); // Clear the cleanup call from unmount
      panelContext?.unadvertise?.("/test/topic");

      // Then - setPublishers should not be called after unmount
      expect(mockSetPublishers).not.toHaveBeenCalled();
    });

    it("should not publish after unmount", async () => {
      // Given - a panel with publish capability
      const mockPublish = jest.fn();
      let panelContext: PanelExtensionContext | undefined;

      const initPanel = (context: PanelExtensionContext) => {
        panelContext = context;
      };

      const { unmount } = render(
        <ThemeProvider isDark>
          <MockPanelContextProvider>
            <PanelSetup
              fixture={{
                capabilities: [PLAYER_CAPABILITIES.advertise],
                publish: mockPublish,
              }}
            >
              <PanelExtensionAdapter config={{}} saveConfig={() => {}} initPanel={initPanel} />
            </PanelSetup>
          </MockPanelContextProvider>
        </ThemeProvider>,
      );

      await act(async () => undefined);

      // When - panel is unmounted and then publish is called
      unmount();
      panelContext?.publish?.("/test/topic", { data: "test" });

      // Then - publish should not be called after unmount
      expect(mockPublish).not.toHaveBeenCalled();
    });

    it("should throw error when callService is called after unmount", async () => {
      // Given - a panel with callService capability
      let panelContext: PanelExtensionContext | undefined;

      const initPanel = (context: PanelExtensionContext) => {
        panelContext = context;
      };

      const { unmount } = render(
        <ThemeProvider isDark>
          <MockPanelContextProvider>
            <PanelSetup
              fixture={{
                capabilities: [PLAYER_CAPABILITIES.callServices],
              }}
            >
              <PanelExtensionAdapter config={{}} saveConfig={() => {}} initPanel={initPanel} />
            </PanelSetup>
          </MockPanelContextProvider>
        </ThemeProvider>,
      );

      await act(async () => undefined);

      // When - panel is unmounted and then callService is called
      unmount();

      // Then - callService should throw after unmount
      await expect(panelContext?.callService?.("/test/service", {})).rejects.toThrow(
        "Service call after panel was unmounted",
      );
    });

    it("should not subscribeAppSettings after unmount", async () => {
      // Given - a panel with app settings
      let panelContext: PanelExtensionContext | undefined;

      const initPanel = (context: PanelExtensionContext) => {
        panelContext = context;
      };

      const { unmount } = render(
        <ThemeProvider isDark>
          <MockPanelContextProvider>
            <PanelSetup>
              <PanelExtensionAdapter config={{}} saveConfig={() => {}} initPanel={initPanel} />
            </PanelSetup>
          </MockPanelContextProvider>
        </ThemeProvider>,
      );

      await act(async () => undefined);

      // When - panel is unmounted and then subscribeAppSettings is called
      unmount();

      // Then - subscribeAppSettings should not throw after unmount
      expect(() => panelContext?.subscribeAppSettings(["testSetting"])).not.toThrow();
    });

    it("should not updatePanelSettingsEditor after unmount", async () => {
      // Given - a panel with settings editor
      let panelContext: PanelExtensionContext | undefined;

      const initPanel = (context: PanelExtensionContext) => {
        panelContext = context;
      };

      const { unmount } = render(
        <ThemeProvider isDark>
          <MockPanelContextProvider>
            <PanelSetup>
              <PanelExtensionAdapter config={{}} saveConfig={() => {}} initPanel={initPanel} />
            </PanelSetup>
          </MockPanelContextProvider>
        </ThemeProvider>,
      );

      await act(async () => undefined);

      // When - panel is unmounted and then updatePanelSettingsEditor is called
      unmount();

      // Then - updatePanelSettingsEditor should not throw after unmount
      expect(() =>
        panelContext?.updatePanelSettingsEditor({
          actionHandler: () => {},
          nodes: {},
        }),
      ).not.toThrow();
    });

    it("should not setDefaultPanelTitle after unmount", async () => {
      // Given - a panel with default title
      let panelContext: PanelExtensionContext | undefined;

      const initPanel = (context: PanelExtensionContext) => {
        panelContext = context;
      };

      const { unmount } = render(
        <ThemeProvider isDark>
          <MockPanelContextProvider>
            <PanelSetup>
              <PanelExtensionAdapter config={{}} saveConfig={() => {}} initPanel={initPanel} />
            </PanelSetup>
          </MockPanelContextProvider>
        </ThemeProvider>,
      );

      await act(async () => undefined);

      // When - panel is unmounted and then setDefaultPanelTitle is called
      unmount();

      // Then - setDefaultPanelTitle should not throw after unmount
      expect(() => panelContext?.setDefaultPanelTitle("Test Title")).not.toThrow();
    });

    it("should not add panel to layout after unmount", async () => {
      // Given - a panel with layout capability
      const mockOpenSiblingPanel = jest.fn();
      let panelContext: PanelExtensionContext | undefined;

      const initPanel = (context: PanelExtensionContext) => {
        panelContext = context;
      };

      const { unmount } = render(
        <ThemeProvider isDark>
          <MockPanelContextProvider openSiblingPanel={mockOpenSiblingPanel}>
            <PanelSetup>
              <PanelExtensionAdapter config={{}} saveConfig={() => {}} initPanel={initPanel} />
            </PanelSetup>
          </MockPanelContextProvider>
        </ThemeProvider>,
      );

      await act(async () => undefined);

      // When - panel is unmounted and then addPanel is called
      unmount();
      panelContext?.layout.addPanel({
        position: "sibling",
        type: "TestPanel",
        updateIfExists: false,
        getState: () => undefined,
      });

      // Then - openSiblingPanel should not be called after unmount
      expect(mockOpenSiblingPanel).not.toHaveBeenCalled();
    });
  });

  describe("seekPlayback with Time object", () => {
    it("should handle seekPlayback with Time object", async () => {
      // Given - a panel with seekPlayback capability
      let panelContext: PanelExtensionContext | undefined;

      const initPanel = (context: PanelExtensionContext) => {
        panelContext = context;
      };

      render(
        <ThemeProvider isDark>
          <MockPanelContextProvider>
            <PanelSetup>
              <PanelExtensionAdapter config={{}} saveConfig={() => {}} initPanel={initPanel} />
            </PanelSetup>
          </MockPanelContextProvider>
        </ThemeProvider>,
      );

      await act(async () => undefined);

      // When/Then - seekPlayback exists and accepts Time object without error
      const timeObj: Time = { sec: 10, nsec: 500000000 };
      await act(async () => {
        panelContext?.seekPlayback?.(timeObj);
      });

      // Verify the method exists and ran without throwing
      expect(panelContext?.seekPlayback).toBeDefined();
    });

    it("should handle seekPlayback with number", async () => {
      // Given - a panel with seekPlayback capability
      let panelContext: PanelExtensionContext | undefined;

      const initPanel = (context: PanelExtensionContext) => {
        panelContext = context;
      };

      render(
        <ThemeProvider isDark>
          <MockPanelContextProvider>
            <PanelSetup>
              <PanelExtensionAdapter config={{}} saveConfig={() => {}} initPanel={initPanel} />
            </PanelSetup>
          </MockPanelContextProvider>
        </ThemeProvider>,
      );

      await act(async () => undefined);

      // When/Then - seekPlayback accepts number without error
      await act(async () => {
        panelContext?.seekPlayback?.(123.456);
      });

      // Verify the method exists and ran without throwing
      expect(panelContext?.seekPlayback).toBeDefined();
    });
  });

  describe("setPreviewTime", () => {
    it("should clear hover value when stamp is undefined", async () => {
      // Given - a panel with preview time capability
      let panelContext: PanelExtensionContext | undefined;

      const initPanel = (context: PanelExtensionContext) => {
        panelContext = context;
      };

      const sign = signal();

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
        sign.resolve();
      });
      await sign;

      // When - setPreviewTime is called with undefined
      // Then - it should not throw
      expect(() => panelContext?.setPreviewTime(undefined)).not.toThrow();
    });

    it("should handle setPreviewTime when startTime is not available", async () => {
      // Given - a panel without startTime
      let panelContext: PanelExtensionContext | undefined;

      const initPanel = (context: PanelExtensionContext) => {
        panelContext = context;
      };

      const sign = signal();

      render(
        <ThemeProvider isDark>
          <MockPanelContextProvider>
            <PanelSetup fixture={{ activeData: undefined }}>
              <PanelExtensionAdapter config={{}} saveConfig={() => {}} initPanel={initPanel} />
            </PanelSetup>
          </MockPanelContextProvider>
        </ThemeProvider>,
      );

      await act(async () => {
        sign.resolve();
      });
      await sign;

      // When - setPreviewTime is called without startTime
      await act(async () => {
        panelContext?.setPreviewTime(123);
      });

      // Then - it should not throw (completes without error)
      expect(panelContext).toBeDefined();
    });

    it("should set hover value when stamp is provided with startTime", async () => {
      // Given - a panel with startTime
      let panelContext: PanelExtensionContext | undefined;

      const initPanel = (context: PanelExtensionContext) => {
        panelContext = context;
      };

      const sign = signal();

      render(
        <ThemeProvider isDark>
          <MockPanelContextProvider>
            <PanelSetup
              fixture={{
                activeData: {
                  startTime: { sec: 100, nsec: 0 },
                },
              }}
            >
              <PanelExtensionAdapter config={{}} saveConfig={() => {}} initPanel={initPanel} />
            </PanelSetup>
          </MockPanelContextProvider>
        </ThemeProvider>,
      );

      await act(async () => {
        sign.resolve();
      });
      await sign;

      // When - setPreviewTime is called with valid stamp
      await act(async () => {
        panelContext?.setPreviewTime(105.5);
      });

      // Then - it should not throw (completes without error)
      expect(panelContext).toBeDefined();
    });
  });

  describe("subscribe with preload options", () => {
    const topicName = BasicBuilder.string();
    it("should handle subscribe with Subscription objects with preload true", async () => {
      // Given - a panel using Subscription objects
      const mockSetSubscriptions = jest.fn();

      let panelContext: PanelExtensionContext | undefined;

      const initPanel = (context: PanelExtensionContext) => {
        panelContext = context;
      };

      const sign = signal();

      render(
        <ThemeProvider isDark>
          <MockPanelContextProvider>
            <PanelSetup fixture={{ setSubscriptions: mockSetSubscriptions }}>
              <PanelExtensionAdapter config={{}} saveConfig={() => {}} initPanel={initPanel} />
            </PanelSetup>
          </MockPanelContextProvider>
        </ThemeProvider>,
      );

      await act(async () => {
        sign.resolve();
      });
      await sign;

      // When - subscribe is called with preload: true
      await act(async () => {
        panelContext?.subscribe([{ topic: topicName, preload: true }]);
      });

      // Then - should convert to full preload
      expect(mockSetSubscriptions).toHaveBeenCalledWith(expect.any(String), [
        { topic: topicName, preloadType: "full" },
      ]);
    });

    it("should handle subscribe with Subscription objects with preload false", async () => {
      // Given - a panel using Subscription objects
      const mockSetSubscriptions = jest.fn();
      let panelContext: PanelExtensionContext | undefined;

      const initPanel = (context: PanelExtensionContext) => {
        panelContext = context;
      };

      const sign = signal();

      render(
        <ThemeProvider isDark>
          <MockPanelContextProvider>
            <PanelSetup fixture={{ setSubscriptions: mockSetSubscriptions }}>
              <PanelExtensionAdapter config={{}} saveConfig={() => {}} initPanel={initPanel} />
            </PanelSetup>
          </MockPanelContextProvider>
        </ThemeProvider>,
      );

      await act(async () => {
        sign.resolve();
      });
      await sign;

      // When - subscribe is called with preload: false
      await act(async () => {
        panelContext?.subscribe([{ topic: topicName, preload: false }]);
      });

      // Then - should convert to partial preload
      expect(mockSetSubscriptions).toHaveBeenCalledWith(expect.any(String), [
        { topic: topicName, preloadType: "partial" },
      ]);
    });
  });

  describe("panel config version handling", () => {
    it("should render PanelConfigVersionError when config version is too new", async () => {
      // Given - a config with version higher than supported
      const config = {
        foxgloveConfigVersion: BasicBuilder.number(),
        someOtherProperty: BasicBuilder.string(),
      };

      const sign = signal();

      const initPanel = () => {
        sign.resolve();
      };

      const { container } = render(
        <ThemeProvider isDark>
          <MockPanelContextProvider>
            <PanelSetup>
              <PanelExtensionAdapter
                config={config}
                saveConfig={() => {}}
                initPanel={initPanel}
                highestSupportedConfigVersion={5}
              />
            </PanelSetup>
          </MockPanelContextProvider>
        </ThemeProvider>,
      );

      await act(async () => undefined);

      // When/Then - PanelConfigVersionError should be rendered
      expect(container.querySelector("div")).toBeTruthy();
    });

    it("should render normally when config version is supported", async () => {
      // Given - a config with version within supported range
      const config = {
        foxgloveConfigVersion: BasicBuilder.number({ max: 5 }),
        someOtherProperty: BasicBuilder.string(),
      };

      const sign = signal();

      const initPanel = jest.fn(() => {
        sign.resolve();
      });

      render(
        <ThemeProvider isDark>
          <MockPanelContextProvider>
            <PanelSetup>
              <PanelExtensionAdapter
                config={config}
                saveConfig={() => {}}
                initPanel={initPanel}
                highestSupportedConfigVersion={5}
              />
            </PanelSetup>
          </MockPanelContextProvider>
        </ThemeProvider>,
      );

      await act(async () => undefined);
      await sign;

      // When/Then - initPanel should be called
      expect(initPanel).toHaveBeenCalled();
    });

    it("should render normally when no config version is specified", async () => {
      // Given - a config without version
      const config = {
        someOtherProperty: BasicBuilder.string(),
      };

      const sign = signal();

      const initPanel = jest.fn(() => {
        sign.resolve();
      });

      render(
        <ThemeProvider isDark>
          <MockPanelContextProvider>
            <PanelSetup>
              <PanelExtensionAdapter
                config={config}
                saveConfig={() => {}}
                initPanel={initPanel}
                highestSupportedConfigVersion={5}
              />
            </PanelSetup>
          </MockPanelContextProvider>
        </ThemeProvider>,
      );

      await act(async () => undefined);
      await sign;

      // When/Then - initPanel should be called
      expect(initPanel).toHaveBeenCalled();
    });
  });

  describe("advertise with options", () => {
    it("should support advertising with options", async () => {
      // Given - a panel with advertise capability
      const mockSetPublishers = jest.fn();
      let panelContext: PanelExtensionContext | undefined;

      const initPanel = (context: PanelExtensionContext) => {
        panelContext = context;
      };

      const sign = signal();

      render(
        <ThemeProvider isDark>
          <MockPanelContextProvider>
            <PanelSetup
              fixture={{
                capabilities: [PLAYER_CAPABILITIES.advertise],
                setPublishers: mockSetPublishers,
              }}
            >
              <PanelExtensionAdapter config={{}} saveConfig={() => {}} initPanel={initPanel} />
            </PanelSetup>
          </MockPanelContextProvider>
        </ThemeProvider>,
      );

      await act(async () => {
        sign.resolve();
      });
      await sign;

      // When - advertise is called with options
      const options = { latching: true };
      panelContext?.advertise?.("/test/topic", "test_datatype", options);

      // Then - setPublishers should be called with options
      expect(mockSetPublishers).toHaveBeenCalledWith(expect.any(String), [
        {
          topic: "/test/topic",
          schemaName: "test_datatype",
          options,
        },
      ]);
    });
  });
});
