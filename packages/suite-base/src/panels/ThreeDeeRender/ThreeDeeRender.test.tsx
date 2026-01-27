/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import "@testing-library/jest-dom";
import { act, render, waitFor } from "@testing-library/react";

import { BuiltinPanelExtensionContext } from "@lichtblick/suite-base/components/PanelExtensionAdapter";
import { useAnalytics } from "@lichtblick/suite-base/context/AnalyticsContext";
import { DEFAULT_FOLLOW_MODE } from "@lichtblick/suite-base/panels/ThreeDeeRender/constants";
import type { MessageEvent } from "@lichtblick/suite-base/players/types";

import { Renderer } from "./Renderer";
import { ThreeDeeRender } from "./ThreeDeeRender";
import { DEFAULT_CAMERA_STATE } from "./camera";
import { MAX_TRANSFORM_MESSAGES } from "./constants";
import type { InterfaceMode, ThreeDeeRenderProps } from "./types";

// three.js modules
jest.mock("./ModelCache", () => ({
  ModelCache: jest.fn(),
}));

jest.mock("./SceneExtensionConfig", () => ({
  DEFAULT_SCENE_EXTENSION_CONFIG: {},
}));

jest.mock("@lichtblick/suite-base/context/AnalyticsContext", () => ({
  useAnalytics: jest.fn(),
}));

const createMockRenderer = (overrides?: Record<string, any>) => {
  const listeners = new Map<string, Set<(...args: any[]) => void>>();
  const defaultRenderer = {
    dispose: jest.fn(),
    config: {},
    setTopics: jest.fn(),
    setParameters: jest.fn(),
    setCurrentTime: jest.fn(),
    handleSeek: jest.fn(),
    setColorScheme: jest.fn(),
    handleAllFramesMessages: jest.fn(),
    addMessageEvent: jest.fn(),
    setCameraState: jest.fn(),
    getCameraState: jest.fn().mockReturnValue(undefined),
    animationFrame: jest.fn(),
    addListener: jest.fn((event: string, listener: (...args: any[]) => void) => {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event)!.add(listener);
    }),
    removeListener: jest.fn((event: string, listener: (...args: any[]) => void) => {
      listeners.get(event)?.delete(listener);
    }),
    emit: (event: string, ...args: any[]) => {
      listeners.get(event)?.forEach((listener) => {
        listener(...args);
      });
    },
    topicSubscriptions: new Map(),
    schemaSubscriptions: new Map(),
    settings: {
      handleAction: jest.fn(),
      tree: jest.fn().mockReturnValue({}),
      errors: {
        on: jest.fn(),
        off: jest.fn(),
      },
    },
    getDropStatus: jest.fn(),
    handleDrop: jest.fn(),
    setAnalytics: jest.fn(),
    setCustomCameraModels: jest.fn(),
    setCameraSyncError: jest.fn(),
    followFrameId: "base_link",
    ros: false,
    currentTime: undefined,
    measurementTool: {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      startMeasuring: jest.fn(),
      stopMeasuring: jest.fn(),
    },
    publishClickTool: {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      setPublishClickType: jest.fn(),
      publishClickType: "point",
    },
  };

  return { ...defaultRenderer, ...overrides };
};

jest.mock("./Renderer", () => ({
  Renderer: jest.fn().mockImplementation(() => createMockRenderer()),
}));

jest.mock("@lichtblick/suite-base/theme/ThemeProvider", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock("./RendererOverlay", () => ({
  RendererOverlay: () => <div data-testid="renderer-overlay">Renderer Overlay</div>,
}));

const createMockContext = (
  overrides: Partial<BuiltinPanelExtensionContext> = {},
): BuiltinPanelExtensionContext => {
  return {
    initialState: {},
    saveState: jest.fn(),
    watch: jest.fn(),
    onRender: undefined,
    subscribe: jest.fn(),
    unsubscribeAll: jest.fn(),
    updatePanelSettingsEditor: jest.fn(),
    setDefaultPanelTitle: jest.fn(),
    unstable_fetchAsset: jest.fn(),
    unstable_setMessagePathDropConfig: jest.fn(),
    unstable_subscribeMessageRange: jest.fn(),
    dataSourceProfile: "ros1",
    layout: {
      addPanel: jest.fn(),
    },
    setVariable: jest.fn(),
    setSharedPanelState: jest.fn(),
    advertise: jest.fn(),
    unadvertise: jest.fn(),
    publish: jest.fn(),
    subscribeAppSettings: jest.fn(),
    ...overrides,
  } as BuiltinPanelExtensionContext;
};

describe("ThreeDeeRender", () => {
  const mockAnalytics = { logEvent: jest.fn() };

  const setup = (
    propsOverrides?: Partial<Omit<ThreeDeeRenderProps, "context">>,
    contextOrOverrides?: BuiltinPanelExtensionContext | Partial<BuiltinPanelExtensionContext>,
  ): ThreeDeeRenderProps => {
    // If contextOrOverrides has 'onRender' property (even if undefined), treat it as a full context
    const context =
      contextOrOverrides && "watch" in contextOrOverrides && "subscribe" in contextOrOverrides
        ? (contextOrOverrides as BuiltinPanelExtensionContext)
        : createMockContext(contextOrOverrides);
    return {
      context,
      interfaceMode: "3d",
      testOptions: {},
      customCameraModels: new Map(),
      ...propsOverrides,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useAnalytics as jest.Mock).mockReturnValue(mockAnalytics);

    // WebGL context
    HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue({
      canvas: document.createElement("canvas"),
      drawArrays: jest.fn(),
      clearColor: jest.fn(),
      clear: jest.fn(),
      viewport: jest.fn(),
    });
  });

  it("renders without crashing", () => {
    // Given
    const props = setup();

    // When
    const { container } = render(<ThreeDeeRender {...props} />);

    // Then
    expect(container).toBeInTheDocument();
  });

  it("renders a canvas element", () => {
    // Given
    const props = setup();

    // When
    const { container } = render(<ThreeDeeRender {...props} />);

    // Then
    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
  });

  it("renders the RendererOverlay component", () => {
    const props = setup();

    const { getByTestId } = render(<ThreeDeeRender {...props} />);
    expect(getByTestId("renderer-overlay")).toBeInTheDocument();
  });

  it("initializes with default camera state when no initial state is provided", () => {
    // Given
    const props = setup();
    const mockedRenderer = jest.mocked(Renderer);

    // When
    const { container } = render(<ThreeDeeRender {...props} />);
    expect(container).toBeInTheDocument();

    // Then
    expect(mockedRenderer).toHaveBeenCalled();
    const rendererConfig = mockedRenderer.mock.calls[0]?.[0]?.config;
    expect(rendererConfig?.cameraState).toMatchObject(DEFAULT_CAMERA_STATE);
    expect(rendererConfig?.followMode).toBe(DEFAULT_FOLLOW_MODE);
    expect(rendererConfig?.followTf).toBeUndefined();
  });

  it("initializes with custom camera state when an initial state is provided", () => {
    // Given
    const customCameraState = {
      cameraState: {
        perspective: true,
        distance: 10,
        far: 1000,
        fovy: 50,
        near: 0.5,
        phi: 45,
        thetaOffset: 90,
        target: [0, 0, 0],
        targetOffset: [0, 0, 0],
        targetOrientation: [0, 0, 0, 1],
      },
      followMode: "follow-position" as const,
      followTf: "base_link",
    };
    const props = setup({}, { initialState: customCameraState });
    const mockedRenderer = jest.mocked(Renderer);

    // When
    const { container } = render(<ThreeDeeRender {...props} />);

    // Then
    expect(container).toBeInTheDocument();

    expect(mockedRenderer).toHaveBeenCalled();
    const rendererConfig = mockedRenderer.mock.calls[0]?.[0]?.config;
    expect(rendererConfig?.cameraState).toEqual(customCameraState.cameraState);
    expect(rendererConfig?.followMode).toBe(customCameraState.followMode);
    expect(rendererConfig?.followTf).toBe(customCameraState.followTf);
  });

  it("initializes with image interface mode", () => {
    // Given
    const initialState = {
      interfaceMode: "image" as InterfaceMode,
    };
    const props = setup({ ...initialState });
    const mockedRenderer = jest.mocked(Renderer);

    // When
    const { container } = render(<ThreeDeeRender {...props} />);

    // Then
    expect(container).toBeInTheDocument();
    expect(mockedRenderer).toHaveBeenCalled();
    const rendererCall = mockedRenderer.mock.calls[0]?.[0];
    expect(rendererCall?.interfaceMode).toBe(initialState.interfaceMode);
  });

  it("passes custom scene extensions to renderer", () => {
    const customSceneExtensions = {
      extensionsById: {
        "foxglove.SceneSettings": {
          init: (renderer: any) => renderer,
          supportedInterfaceModes: ["3d" as const],
        },
      },
    };
    const props = setup({ customSceneExtensions });
    const mockedRenderer = jest.mocked(Renderer);

    const { container } = render(<ThreeDeeRender {...props} />);
    expect(container).toBeInTheDocument();

    expect(mockedRenderer).toHaveBeenCalled();
    const rendererCall = mockedRenderer.mock.calls[0]?.[0];
    expect(rendererCall?.sceneExtensionConfig).toMatchObject(customSceneExtensions);
  });

  it("renders with custom camera models", () => {
    const mockCameraModelBuilder = (info: any) => ({
      width: info.width,
      height: info.height,
      fx: 100,
      fy: 100,
      cx: 50,
      cy: 50,
      projectPixelTo3dPlane: jest.fn(),
      projectPixelTo3dRay: jest.fn(),
    });

    const customCameraModels = new Map([
      [
        "custom_test_model",
        { extensionId: "test-extension", modelBuilder: mockCameraModelBuilder },
      ],
    ]);

    const props = setup({ customCameraModels });
    const mockedRenderer = jest.mocked(Renderer);

    const { container } = render(<ThreeDeeRender {...props} />);
    expect(container).toBeInTheDocument();
    expect(mockedRenderer).toHaveBeenCalled();
    const rendererCall = mockedRenderer.mock.calls[0]?.[0];
    expect(rendererCall?.customCameraModels).toBe(customCameraModels);
  });

  describe("transfom topic preloading", () => {
    const createPreloadingContext = (overrides?: {
      onSubscribe?: (args: any) => (() => void) | void;
      initialState?: any;
    }) => {
      const mockUnsubscribe = jest.fn();
      return createMockContext({
        initialState: {
          scene: {
            transforms: {
              enablePreloading: true,
            },
          },
          topics: {
            "/tf": { visible: true },
            "/tf_static": { visible: true },
            "/new_topic": { visible: true },
          },
          ...overrides?.initialState,
        },
        unstable_subscribeMessageRange: jest.fn((args: any) => {
          const customUnsubscribe = overrides?.onSubscribe?.(args);
          return customUnsubscribe ?? mockUnsubscribe;
        }),
      });
    };

    it("does not trigger if transform preloading is disabled", async () => {
      // Given
      const mockUnsubscribe = jest.fn();

      const customRendererInstance = createMockRenderer({
        schemaSubscriptions: new Map([
          [
            "tf2_msgs/TFMessage",
            [
              {
                preload: false,
              },
            ],
          ],
        ]),
      });
      const topics = [
        { name: "/tf", schemaName: "tf2_msgs/TFMessage", datatype: "tf2_msgs/TFMessage" },
        { name: "/other", schemaName: "std_msgs/String", datatype: "std_msgs/String" },
      ];
      jest.mocked(Renderer).mockImplementationOnce(() => customRendererInstance as any);

      const mockContext = createPreloadingContext({
        onSubscribe: () => mockUnsubscribe,
      });

      const props = setup({}, mockContext);

      // When
      render(<ThreeDeeRender {...props} />);

      await waitFor(() => {
        expect(customRendererInstance.setTopics).toBeDefined();
        expect(mockContext.onRender).toBeDefined();
      });

      act(() => {
        mockContext.onRender!(
          {
            topics,
          },
          jest.fn(),
        );
      });

      await waitFor(() => {
        expect(customRendererInstance.setTopics).toHaveBeenCalledWith(topics);
      });

      // Then
      expect(mockContext.unstable_subscribeMessageRange).toHaveBeenCalledTimes(0);
      expect(mockUnsubscribe).not.toHaveBeenCalled();
    });

    it("triggers re-subscription when preload topics change", async () => {
      // Given
      const mockUnsubscribe = jest.fn();

      const customRendererInstance = createMockRenderer({
        schemaSubscriptions: new Map([
          [
            "tf2_msgs/TFMessage",
            [
              {
                preload: true,
              },
            ],
          ],
        ]),
      });

      jest.mocked(Renderer).mockImplementationOnce(() => customRendererInstance as any);

      const mockContext = createPreloadingContext({
        onSubscribe: () => mockUnsubscribe,
      });

      const props = setup({}, mockContext);
      const topics = [
        { name: "/tf", schemaName: "tf2_msgs/TFMessage", datatype: "tf2_msgs/TFMessage" },
        { name: "/other", schemaName: "std_msgs/String", datatype: "std_msgs/String" },
      ];
      const { rerender } = render(<ThreeDeeRender {...props} />);
      await waitFor(() => {
        expect(customRendererInstance.setTopics).toBeDefined();
        expect(mockContext.onRender).toBeDefined();
      });

      act(() => {
        mockContext.onRender!(
          {
            topics,
          },
          jest.fn(),
        );
      });

      await waitFor(() => {
        expect(customRendererInstance.setTopics).toHaveBeenCalledWith(topics);
      });

      expect(mockContext.unstable_subscribeMessageRange).toHaveBeenCalledTimes(1);
      expect(mockUnsubscribe).not.toHaveBeenCalled();

      // When
      const newTopics = [
        ...topics,
        { name: "/new_topic", schemaName: "tf2_msgs/TFMessage", datatype: "tf2_msgs/TFMessage" },
      ];

      act(() => {
        mockContext.onRender!(
          {
            topics: newTopics,
          },
          jest.fn(),
        );
      });

      rerender(<ThreeDeeRender {...props} />);

      // Then
      // subscribeMessageRange was called 3 times:
      // 1 call for /tf, After adding /new_topic: 2 more calls (for both /tf and /new_topic)
      expect(mockContext.unstable_subscribeMessageRange).toHaveBeenCalledTimes(3);
      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it("does not trigger re-subscription when non-preload topics change", async () => {
      // Given
      const mockUnsubscribe = jest.fn();

      const customRendererInstance = createMockRenderer({
        schemaSubscriptions: new Map([
          [
            "tf2_msgs/TFMessage",
            [
              {
                preload: true,
              },
            ],
          ],
        ]),
      });

      jest.mocked(Renderer).mockImplementationOnce(() => customRendererInstance as any);

      const mockContext = createPreloadingContext({
        onSubscribe: () => mockUnsubscribe,
      });

      const props = setup({}, mockContext);
      const topics = [
        { name: "/tf", schemaName: "tf2_msgs/TFMessage", datatype: "tf2_msgs/TFMessage" },
        { name: "/other", schemaName: "std_msgs/String", datatype: "std_msgs/String" },
      ];
      const { rerender } = render(<ThreeDeeRender {...props} />);
      await waitFor(() => {
        expect(customRendererInstance.setTopics).toBeDefined();
        expect(mockContext.onRender).toBeDefined();
      });

      // Set initial topics to trigger subscription
      act(() => {
        mockContext.onRender!(
          {
            topics,
          },
          jest.fn(),
        );
      });

      await waitFor(() => {
        expect(customRendererInstance.setTopics).toHaveBeenCalledWith(topics);
      });

      expect(mockContext.unstable_subscribeMessageRange).toHaveBeenCalledTimes(1);
      expect(mockUnsubscribe).not.toHaveBeenCalled();

      // When
      // Add a non-preload topic (this shouldn't trigger the useLayoutEffect to re-run)
      const newTopics = [
        ...topics,
        { name: "/new_topic", schemaName: "std_msgs/String", datatype: "std_msgs/String" },
      ];

      act(() => {
        mockContext.onRender!(
          {
            topics: newTopics,
          },
          jest.fn(),
        );
      });

      rerender(<ThreeDeeRender {...props} />);

      // Then
      // subscribeMessageRange was not called again
      expect(mockContext.unstable_subscribeMessageRange).toHaveBeenCalledTimes(1);
      expect(mockUnsubscribe).not.toHaveBeenCalled();
    });

    describe("cleans up subscriptions", () => {
      it("on preload setting disabled", async () => {
        // Given
        const mockUnsubscribe = jest.fn();

        const customRendererInstance = createMockRenderer({
          schemaSubscriptions: new Map([
            [
              "tf2_msgs/TFMessage",
              [
                {
                  preload: true,
                },
              ],
            ],
          ]),
        });

        jest.mocked(Renderer).mockImplementationOnce(() => customRendererInstance as any);

        const mockContext = createPreloadingContext({
          onSubscribe: () => mockUnsubscribe,
        });

        const props = setup({}, mockContext);
        const topics = [
          { name: "/tf", schemaName: "tf2_msgs/TFMessage", datatype: "tf2_msgs/TFMessage" },
        ];
        render(<ThreeDeeRender {...props} />);
        await waitFor(() => {
          expect(customRendererInstance.setTopics).toBeDefined();
          expect(mockContext.onRender).toBeDefined();
        });

        act(() => {
          mockContext.onRender!(
            {
              topics,
            },
            jest.fn(),
          );
        });

        await waitFor(() => {
          expect(customRendererInstance.setTopics).toHaveBeenCalledWith(topics);
        });

        expect(mockContext.unstable_subscribeMessageRange).toHaveBeenCalledTimes(1);
        expect(mockUnsubscribe).not.toHaveBeenCalled();

        // When
        const newTopics = [
          { name: "/new_topic", schemaName: "std_msgs/String", datatype: "std_msgs/String" },
        ];

        act(() => {
          mockContext.onRender!(
            {
              topics: newTopics,
            },
            jest.fn(),
          );
        });

        // Then
        expect(mockUnsubscribe).toHaveBeenCalled();
      });

      it("on unmount", async () => {
        // Given
        const mockUnsubscribe = jest.fn();

        const customRendererInstance = createMockRenderer({
          schemaSubscriptions: new Map([
            [
              "tf2_msgs/TFMessage",
              [
                {
                  preload: true,
                },
              ],
            ],
          ]),
        });

        jest.mocked(Renderer).mockImplementationOnce(() => customRendererInstance as any);

        const mockContext = createPreloadingContext({
          onSubscribe: () => mockUnsubscribe,
        });

        const props = setup({}, mockContext);
        const topics = [
          { name: "/tf", schemaName: "tf2_msgs/TFMessage", datatype: "tf2_msgs/TFMessage" },
        ];
        const { unmount } = render(<ThreeDeeRender {...props} />);
        await waitFor(() => {
          expect(customRendererInstance.setTopics).toBeDefined();
          expect(mockContext.onRender).toBeDefined();
        });

        // When
        act(() => {
          mockContext.onRender!(
            {
              topics,
            },
            jest.fn(),
          );
        });

        await waitFor(() => {
          expect(customRendererInstance.setTopics).toHaveBeenCalledWith(topics);
        });

        expect(mockContext.unstable_subscribeMessageRange).toHaveBeenCalledTimes(1);
        expect(mockUnsubscribe).not.toHaveBeenCalled();

        // When
        unmount();

        // Then
        expect(mockUnsubscribe).toHaveBeenCalled();
      });
    });

    it("trims messages to MAX_TRANSFORM_MESSAGES and keeps oldest", async () => {
      // Given
      const totalMessages = MAX_TRANSFORM_MESSAGES + 100;
      const defaultMessage = {
        topic: "/tf",
        message: { transforms: [] },
        schemaName: "tf2_msgs/TFMessage",
        sizeInBytes: 100,
      };
      const messages: MessageEvent[] = Array.from({ length: totalMessages }, (_, i) => ({
        ...defaultMessage,
        receiveTime: { sec: 100, nsec: i },
      }));

      const topics = [
        { name: "/tf", schemaName: "tf2_msgs/TFMessage", datatype: "tf2_msgs/TFMessage" },
      ];

      const mockBatchIterator = {
        async *[Symbol.asyncIterator]() {
          yield messages;
        },
      };

      const customRendererInstance = createMockRenderer({
        schemaSubscriptions: new Map([
          [
            "tf2_msgs/TFMessage",
            [
              {
                preload: true,
              },
            ],
          ],
        ]),
      });

      jest.mocked(Renderer).mockImplementationOnce(() => customRendererInstance as any);

      const mockContext = createPreloadingContext({
        onSubscribe: (args: any) => {
          void args.onNewRangeIterator?.(mockBatchIterator);
        },
      });

      const props = setup({}, mockContext);

      // When
      render(<ThreeDeeRender {...props} />);

      await waitFor(() => {
        expect(customRendererInstance.setTopics).toBeDefined();
        expect(mockContext.onRender).toBeDefined();
      });

      act(() => {
        mockContext.onRender!(
          {
            topics,
            currentFrame: [],
            currentTime: { sec: 100, nsec: 0 },
          },
          jest.fn(),
        );
      });

      await waitFor(
        () => {
          expect(customRendererInstance.handleAllFramesMessages).toHaveBeenCalled();
          const handleAllFrames = customRendererInstance.handleAllFramesMessages.mock.calls;
          // Get the last call which should have the actual messages
          const lastCall = handleAllFrames[handleAllFrames.length - 1];
          const trimmedMessages = lastCall?.[0];
          expect(trimmedMessages).toBeDefined();
          expect(trimmedMessages.length).toBeGreaterThan(0);
        },
        { timeout: 2000 },
      );

      const handleAllFrames = customRendererInstance.handleAllFramesMessages.mock.calls;
      const lastCall = handleAllFrames[handleAllFrames.length - 1];
      const trimmedMessages = lastCall?.[0];

      // Then
      expect(trimmedMessages).toHaveLength(MAX_TRANSFORM_MESSAGES);

      // Verify the FIRST (oldest) messages were kept
      expect(trimmedMessages[0].receiveTime).toEqual({ sec: 100, nsec: 0 });
      expect(trimmedMessages[MAX_TRANSFORM_MESSAGES - 1].receiveTime).toEqual({
        sec: 100,
        nsec: MAX_TRANSFORM_MESSAGES - 1,
      });
    });
  });
});
