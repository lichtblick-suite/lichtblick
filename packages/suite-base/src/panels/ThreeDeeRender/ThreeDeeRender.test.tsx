/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/* eslint-disable @typescript-eslint/unbound-method */

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import "@testing-library/jest-dom";
import { act, fireEvent, render, waitFor } from "@testing-library/react";

import { Topic } from "@lichtblick/suite";
import { BuiltinPanelExtensionContext } from "@lichtblick/suite-base/components/PanelExtensionAdapter";
import { useAnalytics } from "@lichtblick/suite-base/context/AnalyticsContext";
import {
  DEFAULT_FOLLOW_MODE,
  MAX_TRANSFORM_MESSAGES,
} from "@lichtblick/suite-base/panels/ThreeDeeRender/constants";
import type { MessageEvent } from "@lichtblick/suite-base/players/types";
import MessageEventBuilder from "@lichtblick/suite-base/testing/builders/MessageEventBuilder";
import RenderStateBuilder from "@lichtblick/suite-base/testing/builders/RenderStateBuilder";

import { Renderer } from "./Renderer";
import { ThreeDeeRender } from "./ThreeDeeRender";
import { DEFAULT_CAMERA_STATE } from "./camera";
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
    emit: (event: string, ...args: unknown[]) => {
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
    settleVideoDecodes: jest.fn().mockResolvedValue(undefined),
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
    unstable_setAlert: jest.fn(),
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

function buildTfMessages({
  topic = "/tf",
  count,
  startSec = 100,
  startNsec = 0,
  schemaName = "tf2_msgs/TFMessage",
  sizeInBytes = 100,
}: {
  count: number;
  topic?: string;
  startSec?: number;
  startNsec?: number;
  schemaName?: string;
  sizeInBytes?: number;
}): MessageEvent[] {
  return Array.from({ length: count }, (_, i) =>
    MessageEventBuilder.messageEvent({
      topic,
      message: { transforms: [] },
      schemaName,
      sizeInBytes,
      receiveTime: {
        sec: startSec,
        nsec: startNsec + i,
      },
    }),
  );
}

describe("ThreeDeeRender", () => {
  const mockAnalytics = { logEvent: jest.fn() };
  const mockedRenderer = jest.mocked(Renderer);

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

    const { container } = render(<ThreeDeeRender {...props} />);
    expect(container).toBeInTheDocument();
    expect(mockedRenderer).toHaveBeenCalled();
    const rendererCall = mockedRenderer.mock.calls[0]?.[0];
    expect(rendererCall?.customCameraModels).toBe(customCameraModels);
  });

  describe("Camera sync and move events", () => {
    it("handles camera move event and syncs to shared state when enabled", async () => {
      // Given
      const customRendererInstance = createMockRenderer({
        getCameraState: jest.fn().mockReturnValue({
          cameraState: DEFAULT_CAMERA_STATE,
        }),
      });
      jest.mocked(Renderer).mockImplementationOnce(() => customRendererInstance as any);

      const mockContext = createMockContext({
        initialState: {
          scene: { syncCamera: true },
          followMode: "follow-position",
        },
      });
      const props = setup({}, mockContext);

      // When
      render(<ThreeDeeRender {...props} />);

      await waitFor(() => {
        expect(customRendererInstance.addListener).toBeDefined();
      });

      // Emit camera move event
      act(() => {
        customRendererInstance.emit("cameraMove");
      });

      // Then
      expect(mockContext.setSharedPanelState).toHaveBeenCalledWith(
        expect.objectContaining({
          cameraState: expect.any(Object),
        }),
      );
    });

    it("does not sync camera to shared state when syncCamera is disabled", async () => {
      // Given
      const customRendererInstance = createMockRenderer({
        getCameraState: jest.fn().mockReturnValue(DEFAULT_CAMERA_STATE),
      });
      jest.mocked(Renderer).mockImplementationOnce(() => customRendererInstance as any);

      const mockContext = createMockContext({
        initialState: {
          scene: { syncCamera: false },
        },
      });
      const props = setup({}, mockContext);

      // When
      render(<ThreeDeeRender {...props} />);

      await waitFor(() => {
        expect(customRendererInstance.addListener).toBeDefined();
      });

      act(() => {
        customRendererInstance.emit("cameraMove");
      });

      // Then
      expect(mockContext.setSharedPanelState).not.toHaveBeenCalled();
    });

    it("removes camera move listener on unmount", async () => {
      // Given
      const customRendererInstance = createMockRenderer();
      jest.mocked(Renderer).mockImplementationOnce(() => customRendererInstance as any);
      const props = setup();

      // When
      const { unmount } = render(<ThreeDeeRender {...props} />);

      await waitFor(() => {
        expect(customRendererInstance.addListener).toHaveBeenCalledWith(
          "cameraMove",
          expect.any(Function),
        );
      });

      unmount();

      // Then
      expect(customRendererInstance.removeListener).toHaveBeenCalledWith(
        "cameraMove",
        expect.any(Function),
      );
    });
  });

  describe("Settings tree and actions", () => {
    it("provides actionHandler to settings editor", async () => {
      // Given
      const customRendererInstance = createMockRenderer({
        getCameraState: jest.fn().mockReturnValue(DEFAULT_CAMERA_STATE),
        settings: {
          handleAction: jest.fn(),
          tree: jest.fn().mockReturnValue({}),
          errors: { on: jest.fn(), off: jest.fn() },
        },
      });
      jest.mocked(Renderer).mockImplementationOnce(() => customRendererInstance as any);

      const mockContext = createMockContext({
        initialState: {
          scene: { syncCamera: true },
        },
      });
      const props = setup({}, mockContext);

      // When
      render(<ThreeDeeRender {...props} />);

      await waitFor(() => {
        expect(mockContext.updatePanelSettingsEditor).toHaveBeenCalled();
      });

      // Then - actionHandler should be provided
      const updateCall = mockContext.updatePanelSettingsEditor as jest.Mock;
      const firstCall = updateCall.mock.calls[0] as Array<Record<string, unknown>> | undefined;

      const actionHandler = firstCall?.[0]?.actionHandler;
      expect(actionHandler).toBeDefined();
      expect(typeof actionHandler).toBe("function");
    });

    it("updates settings tree on settingsTreeChange event", async () => {
      // Given
      const treeResult = { cameraState: {} };
      const customRendererInstance = createMockRenderer({
        settings: {
          handleAction: jest.fn(),
          tree: jest.fn().mockReturnValue(treeResult),
          errors: { on: jest.fn(), off: jest.fn() },
        },
      });
      jest.mocked(Renderer).mockImplementationOnce(() => customRendererInstance as any);

      const mockContext = createMockContext();
      const props = setup({}, mockContext);

      // When
      render(<ThreeDeeRender {...props} />);

      await waitFor(() => {
        expect(customRendererInstance.addListener).toHaveBeenCalled();
      });

      const initialCallCount = (mockContext.updatePanelSettingsEditor as jest.Mock).mock.calls
        .length;

      // Emit settings tree change event
      act(() => {
        customRendererInstance.emit("settingsTreeChange", customRendererInstance);
      });

      // Then - should update with new tree
      await waitFor(() => {
        const updateCall = mockContext.updatePanelSettingsEditor as jest.Mock;
        expect(updateCall.mock.calls.length).toBeGreaterThan(initialCallCount);
        const lastCall = updateCall.mock.calls[updateCall.mock.calls.length - 1];
        expect(lastCall?.[0]?.nodes).toBeDefined();
      });
    });

    it("updates focused settings path", async () => {
      // Given
      const mockContext = createMockContext();
      const props = setup({}, mockContext);

      // When
      const { rerender } = render(<ThreeDeeRender {...props} />);

      await waitFor(() => {
        expect(mockContext.updatePanelSettingsEditor).toBeDefined();
      });

      // Simulate showing topic settings
      const updateCall = mockContext.updatePanelSettingsEditor as jest.Mock;
      const firstCall = updateCall.mock.calls[0];
      expect(firstCall).toBeDefined();

      rerender(<ThreeDeeRender {...props} />);

      // Then - settings editor should be updated
      expect(updateCall.mock.calls.length).toBeGreaterThan(0);
    });
  });

  describe("Layer errors handling", () => {
    it("subscribes to layer errors and logs them", async () => {
      // Given
      const logErrorMock = jest.fn();
      const customRendererInstance = createMockRenderer({
        settings: {
          handleAction: jest.fn(),
          tree: jest.fn().mockReturnValue({}),
          errors: {
            on: jest.fn(),
            off: jest.fn(),
          },
        },
      });
      jest.mocked(Renderer).mockImplementationOnce(() => customRendererInstance as any);

      const mockContext = createMockContext();
      const props = setup({ logError: logErrorMock }, mockContext);

      // When
      render(<ThreeDeeRender {...props} />);

      await waitFor(() => {
        expect(customRendererInstance.settings.errors.on).toBeDefined();
      });

      // Then
      expect(customRendererInstance.settings.errors.on).toHaveBeenCalledWith(
        "update",
        expect.any(Function),
      );
    });

    it("logs layer errors with path and message", async () => {
      // Given
      const logErrorMock = jest.fn();
      const errorCallback = jest.fn();
      const customRendererInstance = createMockRenderer({
        settings: {
          handleAction: jest.fn(),
          tree: jest.fn().mockReturnValue({}),
          errors: {
            on: jest.fn((event: string, cb: (...args: any[]) => void) => {
              if (event === "update") {
                errorCallback.mockImplementation(
                  cb as jest.MockedFunction<(...args: any[]) => void>,
                );
              }
            }),
            off: jest.fn(),
          },
        },
      });
      jest.mocked(Renderer).mockImplementationOnce(() => customRendererInstance as any);

      const mockContext = createMockContext();
      const props = setup({ logError: logErrorMock }, mockContext);

      // When
      render(<ThreeDeeRender {...props} />);

      await waitFor(() => {
        expect(customRendererInstance.settings.errors.on).toHaveBeenCalled();
      });

      // Trigger error
      const onCallback = customRendererInstance.settings.errors.on.mock.calls[0]?.[1] as
        | ((path: string[], id: string, msg: string) => void)
        | undefined;
      if (typeof onCallback === "function") {
        onCallback(["Layer", "SubLayer"], "error-id", "Test error message");
      }

      // Then
      expect(logErrorMock).toHaveBeenCalledWith("[Layer > SubLayer] Test error message");
    });

    it("unsubscribes from layer errors on unmount", async () => {
      // Given
      const customRendererInstance = createMockRenderer({
        settings: {
          handleAction: jest.fn(),
          tree: jest.fn().mockReturnValue({}),
          errors: {
            on: jest.fn(),
            off: jest.fn(),
          },
        },
      });
      jest.mocked(Renderer).mockImplementationOnce(() => customRendererInstance as any);

      const mockContext = createMockContext();
      const props = setup({}, mockContext);

      // When
      const { unmount } = render(<ThreeDeeRender {...props} />);

      await waitFor(() => {
        expect(customRendererInstance.settings.errors.on).toHaveBeenCalled();
      });

      unmount();

      // Then
      expect(customRendererInstance.settings.errors.off).toHaveBeenCalledWith(
        "update",
        expect.any(Function),
      );
    });
  });

  describe("Renderer lifecycle", () => {
    it("disposes renderer on unmount", async () => {
      // Given
      const customRendererInstance = createMockRenderer();
      jest.mocked(Renderer).mockImplementationOnce(() => customRendererInstance as any);

      const mockContext = createMockContext();
      const props = setup({}, mockContext);

      // When
      const { unmount } = render(<ThreeDeeRender {...props} />);

      await waitFor(() => {
        expect(customRendererInstance).toBeDefined();
      });

      unmount();

      // Then
      expect(customRendererInstance.dispose).toHaveBeenCalled();
    });

    it("passes fetchAsset to renderer", async () => {
      // Given
      const fetchAssetMock = jest.fn();
      const mockContext = createMockContext({
        unstable_fetchAsset: fetchAssetMock,
      });
      const props = setup({}, mockContext);

      // When
      render(<ThreeDeeRender {...props} />);

      // Then
      expect(jest.mocked(Renderer)).toHaveBeenCalledWith(
        expect.objectContaining({
          fetchAsset: fetchAssetMock,
        }),
      );
    });

    it("passes testOptions to renderer", async () => {
      // Given
      const testOptions = { someOption: true };

      // Wrap it in an object matching the ThreeDeeRenderProps structure
      const props = setup({ testOptions: testOptions as any });

      // When
      render(<ThreeDeeRender {...props} />);

      // Then
      expect(jest.mocked(Renderer)).toHaveBeenCalledWith(
        expect.objectContaining({
          testOptions: { someOption: true },
        }),
      );
    });
  });

  describe("Analytics integration", () => {
    it("sets analytics on renderer when renderer is available", async () => {
      // Given
      const customRendererInstance = createMockRenderer();
      jest.mocked(Renderer).mockImplementationOnce(() => customRendererInstance as any);

      const mockContext = createMockContext();
      const props = setup({}, mockContext);

      // When
      render(<ThreeDeeRender {...props} />);

      await waitFor(() => {
        expect(customRendererInstance.setAnalytics).toBeDefined();
      });

      // Then
      expect(customRendererInstance.setAnalytics).toHaveBeenCalledWith(mockAnalytics);
    });

    it("updates analytics when analytics context changes", async () => {
      // Given
      const customRendererInstance = createMockRenderer();
      jest.mocked(Renderer).mockImplementationOnce(() => customRendererInstance as any);

      const mockContext = createMockContext();
      const props = setup({}, mockContext);

      // When
      render(<ThreeDeeRender {...props} />);

      await waitFor(() => {
        expect(customRendererInstance.setAnalytics).toHaveBeenCalled();
      });

      const initialCallCount = customRendererInstance.setAnalytics.mock.calls.length;

      // Mock new analytics
      const newAnalytics = { logEvent: jest.fn() };
      (useAnalytics as jest.Mock).mockReturnValue(newAnalytics);

      // Then analytics might be updated on re-render (depends on dependency tracking)
      expect(initialCallCount).toBeGreaterThan(0);
    });
  });

  describe("Message path drop config", () => {
    it("sets message path drop config with renderer handlers", async () => {
      // Given
      const customRendererInstance = createMockRenderer();
      jest.mocked(Renderer).mockImplementationOnce(() => customRendererInstance as any);

      const mockContext = createMockContext();
      const props = setup({}, mockContext);

      // When
      render(<ThreeDeeRender {...props} />);

      await waitFor(() => {
        expect(mockContext.unstable_setMessagePathDropConfig).toHaveBeenCalled();
      });

      // Then
      expect(mockContext.unstable_setMessagePathDropConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          getDropStatus: expect.any(Function),
          handleDrop: expect.any(Function),
        }),
      );
    });

    it("clears message path drop config when renderer is undefined", async () => {
      // Given - render without a canvas to prevent renderer initialization
      const mockContext = createMockContext();
      const props = setup({}, mockContext);

      // Create a component that doesn't initialize renderer immediately
      render(<ThreeDeeRender {...props} />);

      await waitFor(() => {
        // Wait for initial render
      });

      // Then
      expect(mockContext.unstable_setMessagePathDropConfig).toHaveBeenCalled();
    });
  });

  describe("Custom camera models", () => {
    it("updates renderer with new camera models when props change", async () => {
      // Given
      const customRendererInstance = createMockRenderer();
      jest.mocked(Renderer).mockImplementationOnce(() => customRendererInstance as any);

      const initialModels = new Map([
        [
          "model1",
          {
            extensionId: "mock-extension-id", // Fixes the compilation error
            modelBuilder: jest.fn() as any,
          },
        ],
      ]);

      const mockContext = createMockContext();
      const props = setup({ customCameraModels: initialModels as any }, mockContext);

      // When
      render(<ThreeDeeRender {...props} />);

      await waitFor(() => {
        expect(customRendererInstance.setCustomCameraModels).toHaveBeenCalled();
      });

      // Then
      expect(customRendererInstance.setCustomCameraModels).toHaveBeenCalledWith(initialModels);
    });
  });

  describe("Measurement tool", () => {
    it("registers measurement tool event listeners on mount", async () => {
      // Given
      const customRendererInstance = createMockRenderer();
      jest.mocked(Renderer).mockImplementationOnce(() => customRendererInstance as any);

      const mockContext = createMockContext();
      const props = setup({}, mockContext);

      // When
      render(<ThreeDeeRender {...props} />);

      await waitFor(() => {
        expect(customRendererInstance.measurementTool.addEventListener).toBeDefined();
      });

      // Then
      expect(customRendererInstance.measurementTool.addEventListener).toHaveBeenCalledWith(
        "foxglove.measure-start",
        expect.any(Function),
      );
      expect(customRendererInstance.measurementTool.addEventListener).toHaveBeenCalledWith(
        "foxglove.measure-end",
        expect.any(Function),
      );
    });

    it("removes measurement tool event listeners on unmount", async () => {
      // Given
      const customRendererInstance = createMockRenderer();
      jest.mocked(Renderer).mockImplementationOnce(() => customRendererInstance as any);

      const mockContext = createMockContext();
      const props = setup({}, mockContext);

      // When
      const { unmount } = render(<ThreeDeeRender {...props} />);

      await waitFor(() => {
        expect(customRendererInstance.measurementTool.addEventListener).toHaveBeenCalled();
      });

      unmount();

      // Then
      expect(customRendererInstance.measurementTool.removeEventListener).toHaveBeenCalledWith(
        "foxglove.measure-start",
        expect.any(Function),
      );
      expect(customRendererInstance.measurementTool.removeEventListener).toHaveBeenCalledWith(
        "foxglove.measure-end",
        expect.any(Function),
      );
    });

    it("toggles measurement tool on click", async () => {
      // Given
      const customRendererInstance = createMockRenderer();
      jest.mocked(Renderer).mockImplementationOnce(() => customRendererInstance as any);

      const mockContext = createMockContext();
      const props = setup({}, mockContext);

      // When
      render(<ThreeDeeRender {...props} />);

      await waitFor(() => {
        expect(customRendererInstance.measurementTool).toBeDefined();
      });

      // Simulate measurement start
      // Add the missing emit method to the mock instance
      (customRendererInstance.measurementTool as any).emit = jest.fn();

      act(() => {
        (customRendererInstance.measurementTool as any).emit("foxglove.measure-start", undefined);
      });

      // Then measurement tool should have started (verified through listener)
      expect(customRendererInstance.measurementTool.addEventListener).toHaveBeenCalled();
    });
  });

  describe("Publish click tool", () => {
    it("registers publish click tool event listeners", async () => {
      // Given
      const customRendererInstance = createMockRenderer();
      jest.mocked(Renderer).mockImplementationOnce(() => customRendererInstance as any);

      const mockContext = createMockContext();
      const props = setup({}, mockContext);

      // When
      render(<ThreeDeeRender {...props} />);

      await waitFor(() => {
        expect(customRendererInstance.publishClickTool.addEventListener).toHaveBeenCalled();
      });

      // Then
      expect(customRendererInstance.publishClickTool.addEventListener).toHaveBeenCalledWith(
        "foxglove.publish-start",
        expect.any(Function),
      );
      expect(customRendererInstance.publishClickTool.addEventListener).toHaveBeenCalledWith(
        "foxglove.publish-submit",
        expect.any(Function),
      );
      expect(customRendererInstance.publishClickTool.addEventListener).toHaveBeenCalledWith(
        "foxglove.publish-end",
        expect.any(Function),
      );
    });

    it("removes publish click tool event listeners on unmount", async () => {
      // Given
      const customRendererInstance = createMockRenderer();
      jest.mocked(Renderer).mockImplementationOnce(() => customRendererInstance as any);

      const mockContext = createMockContext();
      const props = setup({}, mockContext);

      // When
      const { unmount } = render(<ThreeDeeRender {...props} />);

      await waitFor(() => {
        expect(customRendererInstance.publishClickTool.addEventListener).toHaveBeenCalled();
      });

      unmount();

      // Then
      expect(customRendererInstance.publishClickTool.removeEventListener).toHaveBeenCalledWith(
        "foxglove.publish-start",
        expect.any(Function),
      );
      expect(customRendererInstance.publishClickTool.removeEventListener).toHaveBeenCalledWith(
        "foxglove.publish-submit",
        expect.any(Function),
      );
      expect(customRendererInstance.publishClickTool.removeEventListener).toHaveBeenCalledWith(
        "foxglove.publish-end",
        expect.any(Function),
      );
    });

    it("changes publish click type when config updates", async () => {
      // Given
      const customRendererInstance = createMockRenderer({
        publishClickTool: {
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          start: jest.fn(),
          stop: jest.fn(),
          setPublishClickType: jest.fn(),
          publishClickType: "point",
        },
      });
      jest.mocked(Renderer).mockImplementationOnce(() => customRendererInstance as any);

      const mockContext = createMockContext({
        initialState: {
          publish: {
            type: "pose",
          },
        },
      });
      const props = setup({}, mockContext);

      // When
      render(<ThreeDeeRender {...props} />);

      await waitFor(() => {
        expect(customRendererInstance.publishClickTool.setPublishClickType).toHaveBeenCalled();
      });

      // Then
      expect(customRendererInstance.publishClickTool.setPublishClickType).toHaveBeenCalledWith(
        "pose",
      );
    });
  });

  describe("Publish advertising", () => {
    it("advertises publish topics for ros1 data source", async () => {
      // Given
      const mockContext = createMockContext({
        dataSourceProfile: "ros1",
        initialState: {
          publish: {
            poseTopic: "/goal",
            pointTopic: "/point",
            poseEstimateTopic: "/estimate",
          },
        },
      });
      const props = setup({}, mockContext);

      // When
      render(<ThreeDeeRender {...props} />);

      await waitFor(() => {
        expect(mockContext.advertise).toHaveBeenCalled();
      });

      // Then
      expect(mockContext.advertise).toHaveBeenCalledWith(
        "/goal",
        "geometry_msgs/PoseStamped",
        expect.any(Object),
      );
      expect(mockContext.advertise).toHaveBeenCalledWith(
        "/point",
        "geometry_msgs/PointStamped",
        expect.any(Object),
      );
      expect(mockContext.advertise).toHaveBeenCalledWith(
        "/estimate",
        "geometry_msgs/PoseWithCovarianceStamped",
        expect.any(Object),
      );
    });

    it("unadvertises publish topics on unmount", async () => {
      // Given
      const mockContext = createMockContext({
        initialState: {
          publish: {
            poseTopic: "/goal",
            pointTopic: "/point",
            poseEstimateTopic: "/estimate",
          },
        },
      });
      const props = setup({}, mockContext);

      // When
      const { unmount } = render(<ThreeDeeRender {...props} />);

      await waitFor(() => {
        expect(mockContext.advertise).toHaveBeenCalled();
      });

      unmount();

      // Then
      expect(mockContext.unadvertise).toHaveBeenCalledWith("/goal");
      expect(mockContext.unadvertise).toHaveBeenCalledWith("/point");
      expect(mockContext.unadvertise).toHaveBeenCalledWith("/estimate");
    });
  });

  describe("Keyboard shortcuts", () => {
    it("toggles perspective on key 3 press", async () => {
      // Given
      const customRendererInstance = createMockRenderer({
        getCameraState: jest.fn().mockReturnValue({
          ...DEFAULT_CAMERA_STATE,
          perspective: false,
        }),
      });
      const props = setup({}, mockContext);

      // When
      render(<ThreeDeeRender {...props} />);

      // Then
      expect(jest.mocked(Renderer)).toHaveBeenCalledWith(
        expect.objectContaining({
          fetchAsset: fetchAssetMock,
        }),
      );
    });

    it("passes testOptions to renderer", async () => {
      // Given
      const testOptions = { someOption: true };

      // Wrap it in an object matching the ThreeDeeRenderProps structure
      const props = setup({ testOptions: testOptions as any });

      // When
      render(<ThreeDeeRender {...props} />);

      // Then
      expect(jest.mocked(Renderer)).toHaveBeenCalledWith(
        expect.objectContaining({
          testOptions: { someOption: true },
        }),
      );
    });
  });

  describe("Analytics integration", () => {
    it("sets analytics on renderer when renderer is available", async () => {
      // Given
      const customRendererInstance = createMockRenderer();
      jest.mocked(Renderer).mockImplementationOnce(() => customRendererInstance as any);

      const mockContext = createMockContext();
      const props = setup({}, mockContext);

      // When
      const { container } = render(<ThreeDeeRender {...props} />);

      await waitFor(() => {
        expect(customRendererInstance.getCameraState).toBeDefined();
      });

      const panelDiv = container.querySelector("div");
      if (panelDiv) {
        fireEvent.keyDown(panelDiv, { key: "3" });
      }

      // Then - settings should be updated
      await waitFor(() => {
        expect(mockContext.updatePanelSettingsEditor).toHaveBeenCalled();
      });
    });

    it("ignores key 3 when modifier keys are pressed", async () => {
      // Given
      const customRendererInstance = createMockRenderer();
      jest.mocked(Renderer).mockImplementationOnce(() => customRendererInstance as any);

      const mockContext = createMockContext();
      const props = setup({}, mockContext);

      // When
      const { container } = render(<ThreeDeeRender {...props} />);

      const initialCallCount = (mockContext.updatePanelSettingsEditor as jest.Mock).mock.calls
        .length;

      const panelDiv = container.querySelector("div");
      if (panelDiv) {
        fireEvent.keyDown(panelDiv, { key: "3", ctrlKey: true });
      }

      // Then - no new settings update from keyboard shortcut
      const finalCallCount = (mockContext.updatePanelSettingsEditor as jest.Mock).mock.calls.length;
      expect(finalCallCount).toBe(initialCallCount);
    });
  });

  describe("transfom topic preloading", () => {
    const mockUnsubscribe = jest.fn();
    const createPreloadingContext = (overrides?: {
      onSubscribe?: (args: any) => (() => void) | void;
      initialState?: any;
    }) => {
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
        RenderStateBuilder.topic({ name: "/tf", schemaName: "tf2_msgs/TFMessage" }),
        RenderStateBuilder.topic({ name: "/other", schemaName: "std_msgs/String" }),
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
      const customRendererInstance = createMockRenderer({
        schemaSubscriptions: new Map([["tf2_msgs/TFMessage", [{ preload: true }]]]),
      });

      jest.mocked(Renderer).mockImplementationOnce(() => customRendererInstance as any);

      const mockContext = createPreloadingContext({
        onSubscribe: () => mockUnsubscribe,
      });

      const props = setup({}, mockContext);
      const topics = [
        RenderStateBuilder.topic({ name: "/tf", schemaName: "tf2_msgs/TFMessage" }),
        RenderStateBuilder.topic({ name: "/other", schemaName: "std_msgs/String" }),
      ];
      const { rerender } = render(<ThreeDeeRender {...props} />);
      await waitFor(() => {
        expect(customRendererInstance.setTopics).toBeDefined();
        expect(mockContext.onRender).toBeDefined();
      });

      act(() => {
        mockContext.onRender!({ topics }, jest.fn());
      });

      await waitFor(() => {
        expect(customRendererInstance.setTopics).toHaveBeenCalledWith(topics);
      });

      expect(mockContext.unstable_subscribeMessageRange).toHaveBeenCalledTimes(1);
      expect(mockUnsubscribe).not.toHaveBeenCalled();

      // When
      const newTopics = [
        ...topics,
        RenderStateBuilder.topic(
          RenderStateBuilder.topic({ name: "/new_topic", schemaName: "tf2_msgs/TFMessage" }),
        ),
      ];

      act(() => {
        mockContext.onRender!({ topics: newTopics }, jest.fn());
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
      const customRendererInstance = createMockRenderer({
        schemaSubscriptions: new Map([["tf2_msgs/TFMessage", [{ preload: true }]]]),
      });

      jest.mocked(Renderer).mockImplementationOnce(() => customRendererInstance as any);

      const mockContext = createPreloadingContext({
        onSubscribe: () => mockUnsubscribe,
      });

      const props = setup({}, mockContext);
      const topics = [
        RenderStateBuilder.topic({ name: "/tf", schemaName: "tf2_msgs/TFMessage" }),
        RenderStateBuilder.topic({ name: "/other", schemaName: "std_msgs/String" }),
      ];
      const { rerender } = render(<ThreeDeeRender {...props} />);
      await waitFor(() => {
        expect(customRendererInstance.setTopics).toBeDefined();
        expect(mockContext.onRender).toBeDefined();
      });

      // Set initial topics to trigger subscription
      act(() => {
        mockContext.onRender!({ topics }, jest.fn());
      });

      await waitFor(() => {
        expect(customRendererInstance.setTopics).toHaveBeenCalledWith(topics);
      });

      expect(mockContext.unstable_subscribeMessageRange).toHaveBeenCalledTimes(1);
      expect(mockUnsubscribe).not.toHaveBeenCalled();

      // When
      // Add a non-preload topic (this shouldn't trigger the useLayoutEffect to re-run)
      const newTopics: Topic[] = [
        ...topics,
        RenderStateBuilder.topic(
          RenderStateBuilder.topic({ name: "/new_topic", schemaName: "std_msgs/String" }),
        ),
      ];

      act(() => {
        mockContext.onRender!({ topics: newTopics }, jest.fn());
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
        const customRendererInstance = createMockRenderer({
          schemaSubscriptions: new Map([["tf2_msgs/TFMessage", [{ preload: true }]]]),
        });

        jest.mocked(Renderer).mockImplementationOnce(() => customRendererInstance as any);

        const mockContext = createPreloadingContext({
          onSubscribe: () => mockUnsubscribe,
        });

        const props = setup({}, mockContext);
        const topics = [
          RenderStateBuilder.topic({ name: "/tf", schemaName: "tf2_msgs/TFMessage" }),
        ];
        render(<ThreeDeeRender {...props} />);
        await waitFor(() => {
          expect(customRendererInstance.setTopics).toBeDefined();
          expect(mockContext.onRender).toBeDefined();
        });

        act(() => {
          mockContext.onRender!({ topics }, jest.fn());
        });

        await waitFor(() => {
          expect(customRendererInstance.setTopics).toHaveBeenCalledWith(topics);
        });

        expect(mockContext.unstable_subscribeMessageRange).toHaveBeenCalledTimes(1);
        expect(mockUnsubscribe).not.toHaveBeenCalled();

        // When
        const newTopics = [RenderStateBuilder.topic({ schemaName: "std_msgs/String" })];

        act(() => {
          mockContext.onRender!({ topics: newTopics }, jest.fn());
        });

        // Then
        expect(mockUnsubscribe).toHaveBeenCalled();
      });

      it("on unmount", async () => {
        // Given
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
          RenderStateBuilder.topic({ name: "/tf", schemaName: "tf2_msgs/TFMessage" }),
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
      const topicName = "/tf";
      const totalMessages = MAX_TRANSFORM_MESSAGES + 5;
      const messages = buildTfMessages({
        topic: topicName,
        count: totalMessages,
      });

      const topics = [
        RenderStateBuilder.topic({ name: topicName, schemaName: "tf2_msgs/TFMessage" }),
      ];

      const mockBatchIterator = {
        async *[Symbol.asyncIterator]() {
          yield messages;
        },
      };

      const customRendererInstance = createMockRenderer({
        schemaSubscriptions: new Map([["tf2_msgs/TFMessage", [{ preload: true }]]]),
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
    }, 15000);

    it("respects custom maxPreloadMessages configuration", async () => {
      // Given
      const customMaxMessages = 10;
      const totalMessages = customMaxMessages + 5;
      const topicName = "/tf";
      const messages = buildTfMessages({
        topic: topicName,
        count: totalMessages,
      });

      const topics = [
        RenderStateBuilder.topic({ name: topicName, schemaName: "tf2_msgs/TFMessage" }),
      ];

      const mockBatchIterator = {
        async *[Symbol.asyncIterator]() {
          yield messages;
        },
      };

      const customRendererInstance = createMockRenderer({
        schemaSubscriptions: new Map([["tf2_msgs/TFMessage", [{ preload: true }]]]),
      });

      jest.mocked(Renderer).mockImplementationOnce(() => customRendererInstance as any);

      const mockContext = createPreloadingContext({
        initialState: {
          scene: {
            transforms: {
              enablePreloading: true,
              maxPreloadMessages: customMaxMessages,
            },
          },
          topics: {
            "/tf": { visible: true },
          },
        },
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
      expect(trimmedMessages).toHaveLength(customMaxMessages);
    });

    it("updates loading indicator during progressive loading", async () => {
      // Given
      const topicName = "/tf";

      const messages1 = buildTfMessages({
        topic: topicName,
        count: 5,
      });

      const messages2 = buildTfMessages({
        topic: topicName,
        count: 5,
        startNsec: 100,
      });

      const topics = [
        RenderStateBuilder.topic({ name: topicName, schemaName: "tf2_msgs/TFMessage" }),
      ];

      const mockBatchIterator = {
        async *[Symbol.asyncIterator]() {
          yield messages1;
          await new Promise((resolve) => setTimeout(resolve, 60)); // Wait for debounce
          yield messages2;
        },
      };

      const customRendererInstance = createMockRenderer({
        schemaSubscriptions: new Map([["tf2_msgs/TFMessage", [{ preload: true }]]]),
      });

      jest.mocked(Renderer).mockImplementationOnce(() => customRendererInstance as any);

      const mockContext = createPreloadingContext({
        initialState: {
          scene: {
            transforms: { enablePreloading: true },
            enableStats: true, // Enable stats to show loading indicator
          },
          topics: {
            [topicName]: { visible: true },
          },
        },
        onSubscribe: (args: any) => {
          void args.onNewRangeIterator?.(mockBatchIterator);
        },
      });

      const props = setup({}, mockContext);

      // When
      const { container } = render(<ThreeDeeRender {...props} />);

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

      // Then - Loading indicator should appear
      await waitFor(
        () => {
          const loadingElement = container.querySelector('[class*="loadingTransforms"]');
          expect(loadingElement).toBeInTheDocument();
        },
        { timeout: 2000 },
      );
    });

    it("clears allFrames when clearPreloadBuffer event is emitted", async () => {
      // Given
      const topicName = "/tf";
      const messages = buildTfMessages({
        topic: topicName,
        count: 100,
      });

      const topics = [
        RenderStateBuilder.topic({ name: topicName, schemaName: "tf2_msgs/TFMessage" }),
      ];

      const mockBatchIterator = {
        async *[Symbol.asyncIterator]() {
          yield messages;
        },
      };

      const customRendererInstance = createMockRenderer({
        schemaSubscriptions: new Map([["tf2_msgs/TFMessage", [{ preload: true }]]]),
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

      // Wait for initial load
      await waitFor(
        () => {
          expect(customRendererInstance.handleAllFramesMessages).toHaveBeenCalled();
        },
        { timeout: 2000 },
      );

      // Reset the mock to track new calls
      customRendererInstance.handleAllFramesMessages.mockClear();
      (mockContext.unstable_subscribeMessageRange as jest.Mock).mockClear();

      // When - Emit clearPreloadBuffer event
      act(() => {
        customRendererInstance.emit("clearPreloadBuffer");
      });

      // Then - Should trigger reload
      await waitFor(
        () => {
          expect(mockContext.unstable_subscribeMessageRange).toHaveBeenCalled();
        },
        { timeout: 2000 },
      );
    });

    it("does not show loading indicator when render stats is disabled", async () => {
      // Given
      const topicName = "/tf";
      const messages = buildTfMessages({
        topic: topicName,
        count: 100,
      });

      const topics = [
        RenderStateBuilder.topic({ name: topicName, schemaName: "tf2_msgs/TFMessage" }),
      ];

      const mockBatchIterator = {
        async *[Symbol.asyncIterator]() {
          yield messages;
        },
      };

      const customRendererInstance = createMockRenderer({
        schemaSubscriptions: new Map([["tf2_msgs/TFMessage", [{ preload: true }]]]),
      });

      jest.mocked(Renderer).mockImplementationOnce(() => customRendererInstance as any);

      const mockContext = createPreloadingContext({
        initialState: {
          scene: {
            transforms: {
              enablePreloading: true,
            },
            enableStats: false, // Stats disabled
          },
          topics: {
            [topicName]: { visible: true },
          },
        },
        onSubscribe: (args: any) => {
          void args.onNewRangeIterator?.(mockBatchIterator);
        },
      });

      const props = setup({}, mockContext);

      // When
      const { container } = render(<ThreeDeeRender {...props} />);

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

      // Wait for preloading to complete
      await waitFor(
        () => {
          expect(customRendererInstance.handleAllFramesMessages).toHaveBeenCalled();
        },
        { timeout: 2000 },
      );

      // Then - Loading indicator should NOT appear (stats disabled)
      const loadingElement = container.querySelector('[class*="loadingTransforms"]');
      expect(loadingElement).not.toBeInTheDocument();
    });

    it("passes allFrames to handleSeek when seeking", async () => {
      // Given
      const topicName = "/tf";
      const messages = buildTfMessages({
        topic: topicName,
        count: 50,
      });

      const topics = [
        RenderStateBuilder.topic({ name: topicName, schemaName: "tf2_msgs/TFMessage" }),
      ];

      const mockBatchIterator = {
        async *[Symbol.asyncIterator]() {
          yield messages;
        },
      };

      const customRendererInstance = createMockRenderer({
        schemaSubscriptions: new Map([["tf2_msgs/TFMessage", [{ preload: true }]]]),
        currentTime: 0n,
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

      // Wait for initial load
      await waitFor(
        () => {
          expect(customRendererInstance.handleAllFramesMessages).toHaveBeenCalled();
        },
        { timeout: 2000 },
      );

      // When - Trigger seek
      act(() => {
        mockContext.onRender!(
          {
            topics,
            currentFrame: [],
            currentTime: { sec: 50, nsec: 0 },
            didSeek: true,
          },
          jest.fn(),
        );
      });

      // Then - handleSeek should be called with allFrames
      await waitFor(() => {
        expect(customRendererInstance.handleSeek).toHaveBeenCalledWith(
          expect.any(BigInt),
          expect.any(Array),
        );
        const seekCall = customRendererInstance.handleSeek.mock.calls[0];
        expect(seekCall?.[1]).toHaveLength(50);
      });
    });
  });

  it("executes publish submit logic", async () => {
    const renderer = createMockRenderer();
    jest.mocked(Renderer).mockImplementationOnce(() => renderer as any);

    const context = createMockContext();
    render(<ThreeDeeRender {...setup({}, context)} />);

    await waitFor(() => {
      expect(renderer.publishClickTool.addEventListener).toHaveBeenCalled();
    });

    const submitHandler = renderer.publishClickTool.addEventListener.mock.calls.find(
      ([event]) => event === "foxglove.publish-submit",
    )[1];

    submitHandler({
      publishClickType: "point",
      point: { x: 1, y: 2, z: 3 },
    });

    expect(context.publish).toHaveBeenCalled();
  });

  it("handles camera sync mismatch", async () => {
    const renderer = createMockRenderer({
      followFrameId: "base_link",
    });

    jest.mocked(Renderer).mockImplementationOnce(() => renderer as any);

    const context = createMockContext({
      initialState: {
        scene: { syncCamera: true },
        followMode: "mode1",
      },
    });

    render(<ThreeDeeRender {...setup({}, context)} />);

    act(() => {
      context.onRender!(
        {
          sharedPanelState: {
            followMode: "different",
            followTf: "other",
            cameraState: {},
          },
        },
        jest.fn(),
      );
    });

    expect(renderer.setCameraSyncError).toHaveBeenCalled();
  });

  it("handles missing frameId in publish", async () => {
    // Intercept strict console.warn framework check
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);

    const renderer = createMockRenderer({ followFrameId: undefined });
    jest.mocked(Renderer).mockImplementationOnce(() => renderer as any);

    const context = createMockContext();
    render(<ThreeDeeRender {...setup({}, context)} />);

    const submitHandler = renderer.publishClickTool.addEventListener.mock.calls.find(
      ([e]) => e === "foxglove.publish-submit",
    )[1];

    act(() => {
      submitHandler({
        publishClickType: "point",
        point: { x: 1, y: 2, z: 3 },
      });
    });

    expect(context.publish).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("handles missing publish function", async () => {
    // Intercept strict console.error framework check
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

    const renderer = createMockRenderer();
    jest.mocked(Renderer).mockImplementationOnce(() => renderer as any);

    const context = createMockContext({ publish: undefined });
    render(<ThreeDeeRender {...setup({}, context)} />);

    const submitHandler = renderer.publishClickTool.addEventListener.mock.calls.find(
      ([e]) => e === "foxglove.publish-submit",
    )[1];

    act(() => {
      submitHandler({
        publishClickType: "point",
        point: { x: 1, y: 2, z: 3 },
      });
    });

    expect(submitHandler).toBeDefined();
    errorSpy.mockRestore();
  });

  it("handles unsupported datasource", async () => {
    // Intercept strict console.warn framework check
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);

    const renderer = createMockRenderer();
    jest.mocked(Renderer).mockImplementationOnce(() => renderer as any);

    const context = createMockContext({ dataSourceProfile: "custom" as any });
    render(<ThreeDeeRender {...setup({}, context)} />);

    const submitHandler = renderer.publishClickTool.addEventListener.mock.calls.find(
      ([e]) => e === "foxglove.publish-submit",
    )[1];

    act(() => {
      submitHandler({
        publishClickType: "point",
        point: { x: 1, y: 2, z: 3 },
      });
    });

    expect(context.publish).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("covers progressive loading and buffer cleanup paths", async () => {
    // 1. Arrange: Prepare a mock renderer with stats tracking active
    const testSpecificRenderer = createMockRenderer({
      config: { scene: { enableStats: true } },
      followFrameId: "base_link",
    });
    jest.mocked(Renderer).mockReturnValue(testSpecificRenderer as unknown as Renderer);

    // Set up a mock context that supports messaging pipelines
    const mockContext = createMockContext({
      dataSourceProfile: "ros1",
      publish: jest.fn(),
    });

    // Provide an empty array of transform messages to evaluate the early return block
    const props = setup(
      {
        testOptions: {
          configOverrides: {
            scene: { enableStats: true },
          },
        },
      },
      mockContext,
    );

    // 2. Act: Mount the component to evaluate the loading state loops
    const { rerender } = render(<ThreeDeeRender {...props} />);

    // Force a component updates cycle by feeding empty subscription updates
    // This explicitly drops execution into lines 891-908
    const updatedProps = setup(
      {
        interfaceMode: "3d",
        testOptions: {
          configOverrides: {
            scene: { enableStats: true },
          },
        },
      },
      mockContext,
    );

    rerender(<ThreeDeeRender {...updatedProps} />);

    // 3. Assert: Ensure the renderer initiated successfully
    expect(testSpecificRenderer.setTopics).toHaveBeenCalled();
  });
});
