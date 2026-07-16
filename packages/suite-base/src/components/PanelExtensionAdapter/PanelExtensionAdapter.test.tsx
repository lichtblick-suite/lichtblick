/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/* eslint-disable jest/no-done-callback */

import { render } from "@testing-library/react";
import { act } from "react";
import { createStore } from "zustand";

import { Condvar, signal } from "@lichtblick/den/async";
import type { MessageDefinition } from "@lichtblick/message-definition";
import { Time } from "@lichtblick/rostime";
import {
  PanelExtensionContext,
  RenderState,
  MessageEvent,
  Immutable,
  Subscription,
} from "@lichtblick/suite";
import MockPanelContextProvider from "@lichtblick/suite-base/components/MockPanelContextProvider";
import { AlertsContext, AlertsContextStore } from "@lichtblick/suite-base/context/AlertsContext";
import { PLAYER_CAPABILITIES } from "@lichtblick/suite-base/players/constants";
import { AdvertiseOptions } from "@lichtblick/suite-base/players/types";
import * as PanelStateContextProvider from "@lichtblick/suite-base/providers/PanelStateContextProvider";
import PanelSetup, { Fixture } from "@lichtblick/suite-base/stories/PanelSetup";
import ThemeProvider from "@lichtblick/suite-base/theme/ThemeProvider";

import PanelExtensionAdapter from "./PanelExtensionAdapter";
import { BuiltinPanelExtensionContext } from "./types";

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

  it("should apply sampling when converter supports latest-per-render-tick", async () => {
    const sig = signal();
    const initPanel = (context: PanelExtensionContext) => {
      context.subscribe([
        { topic: "/test", convertTo: "dst", sampling: { mode: "latest-per-render-tick" } },
      ]);
    };

    render(
      <ThemeProvider isDark>
        <MockPanelContextProvider>
          <PanelSetup
            fixture={{
              topics: [{ name: "/test", schemaName: "src" }],
              messageConverters: [
                {
                  fromSchemaName: "src",
                  toSchemaName: "dst",
                  supportsLatestPerRenderTick: true,
                  converter: () => ({}),
                },
              ],
              setSubscriptions: (_, payload) => {
                if (payload.length === 0) {
                  return;
                }
                expect(payload).toEqual([
                  {
                    topic: "/test",
                    preloadType: "partial",
                    samplingRequest: { mode: "latest-per-render-tick" },
                    samplingAuthorized: true,
                  },
                ]);
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

  it("should disable sampling for native subscriptions by default", async () => {
    const sig = signal();
    const initPanel = (context: PanelExtensionContext) => {
      context.subscribe([{ topic: "/test", sampling: { mode: "latest-per-render-tick" } }]);
    };

    render(
      <ThemeProvider isDark>
        <MockPanelContextProvider>
          <PanelSetup
            fixture={{
              topics: [{ name: "/test", schemaName: "src" }],
              setSubscriptions: (_, payload) => {
                if (payload.length === 0) {
                  return;
                }
                expect(payload).toEqual([{ topic: "/test", preloadType: "partial" }]);
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

  it("should disable sampling when convertTo resolves to the native topic schema", async () => {
    const sig = signal();
    const initPanel = (context: PanelExtensionContext) => {
      context.subscribe([
        { topic: "/test", convertTo: "src", sampling: { mode: "latest-per-render-tick" } },
      ]);
    };

    render(
      <ThemeProvider isDark>
        <MockPanelContextProvider>
          <PanelSetup
            fixture={{
              topics: [{ name: "/test", schemaName: "src" }],
              setSubscriptions: (_, payload) => {
                if (payload.length === 0) {
                  return;
                }
                expect(payload).toEqual([{ topic: "/test", preloadType: "partial" }]);
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

  it("should disable sampling when converter does not support latest-per-render-tick", async () => {
    const sig = signal();
    const initPanel = (context: PanelExtensionContext) => {
      context.subscribe([
        { topic: "/test", convertTo: "dst", sampling: { mode: "latest-per-render-tick" } },
      ]);
    };

    render(
      <ThemeProvider isDark>
        <MockPanelContextProvider>
          <PanelSetup
            fixture={{
              topics: [{ name: "/test", schemaName: "src" }],
              messageConverters: [
                {
                  fromSchemaName: "src",
                  toSchemaName: "dst",
                  converter: () => ({}),
                },
              ],
              setSubscriptions: (_, payload) => {
                if (payload.length === 0) {
                  return;
                }
                expect(payload).toEqual([{ topic: "/test", preloadType: "partial" }]);
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

  it("should disable sampling when preload is true even if converter supports it", async () => {
    const sig = signal();
    const initPanel = (context: PanelExtensionContext) => {
      context.subscribe([
        {
          topic: "/test",
          convertTo: "dst",
          preload: true,
          sampling: { mode: "latest-per-render-tick" },
        },
      ]);
    };

    render(
      <ThemeProvider isDark>
        <MockPanelContextProvider>
          <PanelSetup
            fixture={{
              topics: [{ name: "/test", schemaName: "src" }],
              messageConverters: [
                {
                  fromSchemaName: "src",
                  toSchemaName: "dst",
                  supportsLatestPerRenderTick: true,
                  converter: () => ({}),
                },
              ],
              setSubscriptions: (_, payload) => {
                if (payload.length === 0) {
                  return;
                }
                expect(payload).toEqual([{ topic: "/test", preloadType: "full" }]);
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

  describe("extensionSettingsActionHandler - reorder-node branch", () => {
    it("should return early for reorder-node actions without saving config", async () => {
      // Given: A mock updatePanelSettingsTree to capture the wrapped actionHandler
      const updatePanelSettingsTreeMock = jest.fn();
      jest
        .spyOn(PanelStateContextProvider, "usePanelSettingsTreeUpdate")
        .mockReturnValue(updatePanelSettingsTreeMock);

      const saveConfig = jest.fn();
      const settingsActionHandler = jest.fn();

      const initPanel = (context: PanelExtensionContext) => {
        context.updatePanelSettingsEditor({
          actionHandler: settingsActionHandler,
          nodes: {},
        });
      };

      // When: Rendering the adapter and invoking the captured action handler with reorder-node
      render(
        <ThemeProvider isDark>
          <MockPanelContextProvider>
            <PanelSetup>
              <PanelExtensionAdapter config={{}} saveConfig={saveConfig} initPanel={initPanel} />
            </PanelSetup>
          </MockPanelContextProvider>
        </ThemeProvider>,
      );

      // Then: The wrapper action handler should exist and call the original handler but not saveConfig
      const wrappedActionHandler = updatePanelSettingsTreeMock.mock.calls[0]?.[0]?.actionHandler;
      expect(typeof wrappedActionHandler).toBe("function");

      wrappedActionHandler?.({
        action: "reorder-node",
        payload: { path: ["topics", "topic1"] },
      });

      expect(settingsActionHandler).toHaveBeenCalledTimes(1);
      expect(saveConfig).not.toHaveBeenCalled();
    });
  });

  describe("getTopicSchema", () => {
    it("returns the schema definition for a known topic", async () => {
      // GIVEN a panel with a topic whose schema is registered in the datatypes
      const sig = signal<Immutable<MessageDefinition> | undefined>();

      // WHEN the panel requests the schema for that topic
      const initPanel = (context: PanelExtensionContext) => {
        const schema = context.getTopicSchema("/some/topic");
        sig.resolve(schema);
      };

      render(
        <ThemeProvider isDark>
          <MockPanelContextProvider>
            <PanelSetup
              fixture={{
                topics: [{ name: "/some/topic", schemaName: "some_msgs/Data" }],
                datatypes: new Map([
                  [
                    "some_msgs/Data",
                    {
                      name: "some_msgs/Data",
                      definitions: [
                        { name: "value", type: "uint32", isArray: false, isComplex: false },
                      ],
                    },
                  ],
                ]),
                frame: {},
              }}
            >
              <PanelExtensionAdapter config={{}} saveConfig={() => {}} initPanel={initPanel} />
            </PanelSetup>
          </MockPanelContextProvider>
        </ThemeProvider>,
      );

      await act(async () => undefined);
      const schema = await sig;

      // THEN the matching message definition is returned
      expect(schema).toEqual({
        name: "some_msgs/Data",
        definitions: [{ name: "value", type: "uint32", isArray: false, isComplex: false }],
      });
    });

    it("returns undefined for an unknown topic", async () => {
      // GIVEN a panel whose fixture does not contain the requested topic
      const sig = signal<Immutable<MessageDefinition> | undefined>();

      // WHEN the panel requests the schema for a nonexistent topic
      const initPanel = (context: PanelExtensionContext) => {
        const schema = context.getTopicSchema("/nonexistent/topic");
        sig.resolve(schema);
      };

      render(
        <ThemeProvider isDark>
          <MockPanelContextProvider>
            <PanelSetup
              fixture={{
                topics: [{ name: "/some/topic", schemaName: "some_msgs/Data" }],
                datatypes: new Map([
                  [
                    "some_msgs/Data",
                    {
                      name: "some_msgs/Data",
                      definitions: [
                        { name: "value", type: "uint32", isArray: false, isComplex: false },
                      ],
                    },
                  ],
                ]),
                frame: {},
              }}
            >
              <PanelExtensionAdapter config={{}} saveConfig={() => {}} initPanel={initPanel} />
            </PanelSetup>
          </MockPanelContextProvider>
        </ThemeProvider>,
      );

      await act(async () => undefined);
      const schema = await sig;

      // THEN no schema is returned
      expect(schema).toBeUndefined();
    });

    it("returns undefined when no active data source is available", async () => {
      // GIVEN a panel with no active data source (empty fixture)
      const sig = signal<Immutable<MessageDefinition> | undefined>();

      // WHEN the panel requests a topic schema
      const initPanel = (context: PanelExtensionContext) => {
        const schema = context.getTopicSchema("/some/topic");
        sig.resolve(schema);
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
      const schema = await sig;

      // THEN no schema is returned
      expect(schema).toBeUndefined();
    });

    it("returns undefined when called after the panel is unmounted", async () => {
      // GIVEN a panel context captured while the panel is mounted
      const sig = signal<PanelExtensionContext>();

      const initPanel = (context: PanelExtensionContext) => {
        sig.resolve(context);
      };

      const { unmount } = render(
        <ThemeProvider isDark>
          <MockPanelContextProvider>
            <PanelSetup
              fixture={{
                topics: [{ name: "/some/topic", schemaName: "some_msgs/Data" }],
                datatypes: new Map([
                  [
                    "some_msgs/Data",
                    {
                      name: "some_msgs/Data",
                      definitions: [
                        { name: "value", type: "uint32", isArray: false, isComplex: false },
                      ],
                    },
                  ],
                ]),
                frame: {},
              }}
            >
              <PanelExtensionAdapter config={{}} saveConfig={() => {}} initPanel={initPanel} />
            </PanelSetup>
          </MockPanelContextProvider>
        </ThemeProvider>,
      );

      await act(async () => undefined);
      const context = await sig;

      // WHEN the panel is unmounted and the schema is requested afterwards
      unmount();

      // THEN no schema is returned
      expect(context.getTopicSchema("/some/topic")).toBeUndefined();
    });
  });

  describe("getSchema", () => {
    it("returns the schema definition for a known schemaName", async () => {
      // GIVEN a panel with a schema registered in the datatypes
      const sig = signal<Immutable<MessageDefinition> | undefined>();

      // WHEN the panel requests the schema by its name
      const initPanel = (context: PanelExtensionContext) => {
        const schema = context.getSchema("known_schema/Data");
        sig.resolve(schema);
      };

      render(
        <ThemeProvider isDark>
          <MockPanelContextProvider>
            <PanelSetup
              fixture={{
                topics: [{ name: "/some/topic", schemaName: "known_schema/Data" }],
                datatypes: new Map([
                  [
                    "known_schema/Data",
                    {
                      name: "known_schema/Data",
                      definitions: [
                        { name: "value", type: "uint32", isArray: false, isComplex: false },
                      ],
                    },
                  ],
                ]),
                frame: {},
              }}
            >
              <PanelExtensionAdapter config={{}} saveConfig={() => {}} initPanel={initPanel} />
            </PanelSetup>
          </MockPanelContextProvider>
        </ThemeProvider>,
      );

      await act(async () => undefined);
      const schema = await sig;

      // THEN the matching message definition is returned
      expect(schema).toEqual({
        name: "known_schema/Data",
        definitions: [{ name: "value", type: "uint32", isArray: false, isComplex: false }],
      });
    });

    it("returns undefined for an unknown schemaName", async () => {
      // GIVEN a panel whose datatypes do not contain the requested schema
      const sig = signal<Immutable<MessageDefinition> | undefined>();

      // WHEN the panel requests a nonexistent schema by name
      const initPanel = (context: PanelExtensionContext) => {
        const schema = context.getSchema("nonexistent_schema/Data");
        sig.resolve(schema);
      };

      render(
        <ThemeProvider isDark>
          <MockPanelContextProvider>
            <PanelSetup
              fixture={{
                topics: [{ name: "/some/topic", schemaName: "known_schema/Data" }],
                datatypes: new Map([
                  [
                    "known_schema/Data",
                    {
                      name: "known_schema/Data",
                      definitions: [
                        { name: "value", type: "uint32", isArray: false, isComplex: false },
                      ],
                    },
                  ],
                ]),
                frame: {},
              }}
            >
              <PanelExtensionAdapter config={{}} saveConfig={() => {}} initPanel={initPanel} />
            </PanelSetup>
          </MockPanelContextProvider>
        </ThemeProvider>,
      );

      await act(async () => undefined);
      const schema = await sig;

      // THEN no schema is returned
      expect(schema).toBeUndefined();
    });

    it("returns undefined when no active data source is available", async () => {
      // GIVEN a panel with no active data source (empty fixture)
      const sig = signal<Immutable<MessageDefinition> | undefined>();

      // WHEN the panel requests a schema by name
      const initPanel = (context: PanelExtensionContext) => {
        const schema = context.getSchema("some_msgs/Data");
        sig.resolve(schema);
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
      const schema = await sig;

      // THEN no schema is returned
      expect(schema).toBeUndefined();
    });

    it("returns undefined when called after the panel is unmounted", async () => {
      // GIVEN a panel context captured while the panel is mounted
      const sig = signal<PanelExtensionContext>();

      const initPanel = (context: PanelExtensionContext) => {
        sig.resolve(context);
      };

      const { unmount } = render(
        <ThemeProvider isDark>
          <MockPanelContextProvider>
            <PanelSetup
              fixture={{
                topics: [{ name: "/some/topic", schemaName: "known_schema/Data" }],
                datatypes: new Map([
                  [
                    "known_schema/Data",
                    {
                      name: "known_schema/Data",
                      definitions: [
                        { name: "value", type: "uint32", isArray: false, isComplex: false },
                      ],
                    },
                  ],
                ]),
                frame: {},
              }}
            >
              <PanelExtensionAdapter config={{}} saveConfig={() => {}} initPanel={initPanel} />
            </PanelSetup>
          </MockPanelContextProvider>
        </ThemeProvider>,
      );

      await act(async () => undefined);
      const context = await sig;

      // WHEN the panel is unmounted and the schema is requested afterwards
      unmount();

      // THEN no schema is returned
      expect(context.getSchema("known_schema/Data")).toBeUndefined();
    });
  });

  describe("unstable_setAlert", () => {
    function makeAlertsStore() {
      const setAlert = jest.fn();
      const clearAlert = jest.fn();
      const store = createStore<AlertsContextStore>(() => ({
        alerts: [],
        actions: { setAlert, clearAlert, clearAlerts: jest.fn() },
      }));
      return { store, setAlert, clearAlert };
    }

    it("sets an app-level alert scoped to the panel", async () => {
      // GIVEN a panel that sets an alert during init
      const { store, setAlert } = makeAlertsStore();
      const alert = { severity: "error", message: "boom" } as const;

      const sig = signal();
      const initPanel = (context: PanelExtensionContext) => {
        (context as BuiltinPanelExtensionContext).unstable_setAlert?.("my-alert", alert);
        sig.resolve();
      };

      // WHEN the panel is rendered
      render(
        <ThemeProvider isDark>
          <MockPanelContextProvider>
            <PanelSetup>
              <AlertsContext.Provider value={store}>
                <PanelExtensionAdapter config={{}} saveConfig={() => {}} initPanel={initPanel} />
              </AlertsContext.Provider>
            </PanelSetup>
          </MockPanelContextProvider>
        </ThemeProvider>,
      );
      await act(async () => undefined);
      await sig;

      // THEN setAlert is called with a panel-scoped tag and the alert
      expect(setAlert).toHaveBeenCalledWith(
        expect.stringMatching(/^panel-alert:.+:my-alert$/),
        alert,
      );
    });

    it("clears the alert when passed undefined", async () => {
      // GIVEN a panel that clears an alert during init
      const { store, clearAlert } = makeAlertsStore();

      const sig = signal();
      const initPanel = (context: PanelExtensionContext) => {
        (context as BuiltinPanelExtensionContext).unstable_setAlert?.("my-alert", undefined);
        sig.resolve();
      };

      // WHEN the panel is rendered
      render(
        <ThemeProvider isDark>
          <MockPanelContextProvider>
            <PanelSetup>
              <AlertsContext.Provider value={store}>
                <PanelExtensionAdapter config={{}} saveConfig={() => {}} initPanel={initPanel} />
              </AlertsContext.Provider>
            </PanelSetup>
          </MockPanelContextProvider>
        </ThemeProvider>,
      );
      await act(async () => undefined);
      await sig;

      // THEN clearAlert is called with the panel-scoped tag
      expect(clearAlert).toHaveBeenCalledWith(expect.stringMatching(/^panel-alert:.+:my-alert$/));
    });

    it("clears panel alerts on unmount", async () => {
      // GIVEN a panel that set an alert
      const { store, clearAlert } = makeAlertsStore();
      const alert = { severity: "warn", message: "watch out" } as const;

      const sig = signal();
      const initPanel = (context: PanelExtensionContext) => {
        (context as BuiltinPanelExtensionContext).unstable_setAlert?.("my-alert", alert);
        sig.resolve();
      };

      const { unmount } = render(
        <ThemeProvider isDark>
          <MockPanelContextProvider>
            <PanelSetup>
              <AlertsContext.Provider value={store}>
                <PanelExtensionAdapter config={{}} saveConfig={() => {}} initPanel={initPanel} />
              </AlertsContext.Provider>
            </PanelSetup>
          </MockPanelContextProvider>
        </ThemeProvider>,
      );
      await act(async () => undefined);
      await sig;
      clearAlert.mockClear();

      // WHEN the panel is unmounted
      await act(async () => {
        unmount();
      });

      // THEN the previously set alert is cleared
      expect(clearAlert).toHaveBeenCalledWith(expect.stringMatching(/^panel-alert:.+:my-alert$/));
    });
  });
});
