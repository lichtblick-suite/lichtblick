/** @vitest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { Mocked, MockedFunction, Mock } from "vitest";
import { act, render, renderHook } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { PropsWithChildren, useContext } from "react";
import { useLocalStorage } from "react-use";

import Log from "@lichtblick/log";
import { SESSION_STORAGE_LOGS_SETTINGS } from "@lichtblick/suite-base/constants/browserStorageKeys";
import {
  StudioLogsSettingsContext,
  IStudioLogsSettings,
} from "@lichtblick/suite-base/context/StudioLogsSettingsContext";
import { BasicBuilder } from "@lichtblick/test-builders";

import { StudioLogsSettingsProvider } from "./StudioLogsSettingsProvider";
import { createStudioLogsSettingsStore } from "./store";

vi.mock("react-use", async () => ({
  useLocalStorage: vi.fn(),
}));

vi.mock("@lichtblick/log");

vi.mock("./store", async () => ({
  createStudioLogsSettingsStore: vi.fn(),
}));

const mockUseLocalStorage = useLocalStorage as MockedFunction<typeof useLocalStorage>;
const mockLog = Log as Mocked<typeof Log>;
const mockCreateStudioLogsSettingsStore = createStudioLogsSettingsStore as MockedFunction<
  typeof createStudioLogsSettingsStore
>;

describe("StudioLogsSettingsProvider", () => {
  const mockStore = {
    getState: vi.fn<IStudioLogsSettings, []>(),
    setState: vi.fn(),
    subscribe: vi.fn<() => void, [(state: IStudioLogsSettings) => void]>(),
    destroy: vi.fn(),
    getInitialState: vi.fn<IStudioLogsSettings, []>(),
  };

  const createMockLogger = (): Partial<any> => ({
    name: vi.fn().mockReturnValue("test-logger"),
    setLevel: vi.fn(),
    isLevelOn: vi.fn().mockReturnValue(true),
    getLevel: vi.fn().mockReturnValue("info"),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  });

  const mockLogger = createMockLogger();

  const defaultMockState: IStudioLogsSettings = {
    channels: [{ name: BasicBuilder.string(), enabled: true }],
    globalLevel: "info",
    setGlobalLevel: vi.fn(),
    enableChannel: vi.fn(),
    disableChannel: vi.fn(),
    enablePrefix: vi.fn(),
    disablePrefix: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockUseLocalStorage.mockReturnValue([{}, vi.fn(), vi.fn()]);
    (mockLog.channels as Mock).mockReturnValue([mockLogger]);
    (mockCreateStudioLogsSettingsStore as Mock).mockReturnValue(mockStore);
    mockStore.getState.mockReturnValue(defaultMockState);
    mockStore.subscribe.mockReturnValue(vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Component Initialization", () => {
    it("should initialize with empty local storage state", () => {
      // Given
      const setSavedState = vi.fn();
      const removeSavedState = vi.fn();
      mockUseLocalStorage.mockReturnValue([{}, setSavedState, removeSavedState]);

      // When
      render(
        <StudioLogsSettingsProvider>
          <div>Test Child</div>
        </StudioLogsSettingsProvider>,
      );

      // Then
      expect(mockCreateStudioLogsSettingsStore).toHaveBeenCalledWith({});
    });

    it("should initialize with existing local storage state", () => {
      // Given
      const savedState = {
        globalLevel: "debug",
        disabledChannels: [BasicBuilder.string(), BasicBuilder.string()],
      };
      const setSavedState = vi.fn();
      const removeSavedState = vi.fn();
      mockUseLocalStorage.mockReturnValue([savedState, setSavedState, removeSavedState]);

      // When
      render(
        <StudioLogsSettingsProvider>
          <div>Test Child</div>
        </StudioLogsSettingsProvider>,
      );

      // Then
      expect(mockCreateStudioLogsSettingsStore).toHaveBeenCalledWith(savedState);
    });

    it("should use correct session storage key", () => {
      // Given
      // When
      render(
        <StudioLogsSettingsProvider>
          <div>Test Child</div>
        </StudioLogsSettingsProvider>,
      );

      // Then
      expect(mockUseLocalStorage).toHaveBeenCalledWith(SESSION_STORAGE_LOGS_SETTINGS, {});
    });
  });

  describe("Context Provider", () => {
    it("should provide store through context", () => {
      // Given
      const TestConsumer = () => {
        const store = useContext(StudioLogsSettingsContext);
        return <div data-testid="store-provided">{store ? "provided" : "not-provided"}</div>;
      };

      // When
      const { getByTestId } = render(
        <StudioLogsSettingsProvider>
          <TestConsumer />
        </StudioLogsSettingsProvider>,
      );

      // Then
      expect(getByTestId("store-provided")).toHaveTextContent("provided");
    });

    it("should render children correctly", () => {
      // Given
      const ChildComponent = () => <div data-testid="child">Child Content</div>;

      // When
      const { getByTestId } = render(
        <StudioLogsSettingsProvider>
          <ChildComponent />
        </StudioLogsSettingsProvider>,
      );

      // Then
      expect(getByTestId("child")).toHaveTextContent("Child Content");
    });
  });

  describe("Channel Count Monitoring", () => {
    it("should recreate store when channel count changes", () => {
      // Given
      (mockLog.channels as Mock).mockReturnValue([mockLogger]);
      mockStore.getState.mockReturnValue({
        ...defaultMockState,
        channels: [{ name: BasicBuilder.string(), enabled: true }],
      });

      render(
        <StudioLogsSettingsProvider>
          <div>Test</div>
        </StudioLogsSettingsProvider>,
      );

      // When
      const newLogger = createMockLogger();
      (mockLog.channels as Mock).mockReturnValue([mockLogger, newLogger]);

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Then
      expect(mockCreateStudioLogsSettingsStore).toHaveBeenCalledTimes(2);
    });

    it("should not recreate store when channel count remains same", () => {
      // Given
      (mockLog.channels as Mock).mockReturnValue([mockLogger]);
      mockStore.getState.mockReturnValue({
        ...defaultMockState,
        channels: [{ name: BasicBuilder.string(), enabled: true }],
      });

      render(
        <StudioLogsSettingsProvider>
          <div>Test</div>
        </StudioLogsSettingsProvider>,
      );

      // When
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Then
      expect(mockCreateStudioLogsSettingsStore).toHaveBeenCalledTimes(1);
    });

    it("should clean up interval on unmount", () => {
      // Given
      const clearIntervalSpy = vi.spyOn(global, "clearInterval");
      const { unmount } = render(
        <StudioLogsSettingsProvider>
          <div>Test</div>
        </StudioLogsSettingsProvider>,
      );

      // When
      unmount();

      // Then
      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });

  describe("Store Subscription and State Persistence", () => {
    it("should save state to local storage when store changes", () => {
      // Given
      let subscriptionCallback: ((value: IStudioLogsSettings) => void) | undefined;
      const setSavedState = vi.fn();
      const removeSavedState = vi.fn();
      mockUseLocalStorage.mockReturnValue([{}, setSavedState, removeSavedState]);
      mockStore.subscribe.mockImplementation((callback: (state: IStudioLogsSettings) => void) => {
        subscriptionCallback = callback;
        return vi.fn(); // unsubscribe function
      });

      render(
        <StudioLogsSettingsProvider>
          <div>Test</div>
        </StudioLogsSettingsProvider>,
      );

      // When
      const newState: IStudioLogsSettings = {
        globalLevel: "debug",
        channels: [
          { name: BasicBuilder.string(), enabled: false },
          { name: BasicBuilder.string(), enabled: true },
          { name: BasicBuilder.string(), enabled: false },
        ],
        setGlobalLevel: vi.fn(),
        enableChannel: vi.fn(),
        disableChannel: vi.fn(),
        enablePrefix: vi.fn(),
        disablePrefix: vi.fn(),
      };

      act(() => {
        subscriptionCallback?.(newState);
      });

      // Then
      expect(setSavedState).toHaveBeenCalledWith({
        globalLevel: "debug",
        disabledChannels: [newState.channels[0]!.name, newState.channels[2]!.name],
      });
    });

    it("should save empty disabled channels when all channels are enabled", () => {
      // Given
      let subscriptionCallback: ((value: IStudioLogsSettings) => void) | undefined;
      const setSavedState = vi.fn();
      const removeSavedState = vi.fn();
      mockUseLocalStorage.mockReturnValue([{}, setSavedState, removeSavedState]);
      mockStore.subscribe.mockImplementation((callback: (state: IStudioLogsSettings) => void) => {
        subscriptionCallback = callback;
        return vi.fn();
      });

      render(
        <StudioLogsSettingsProvider>
          <div>Test</div>
        </StudioLogsSettingsProvider>,
      );

      // When
      const newState: IStudioLogsSettings = {
        globalLevel: "info",
        channels: [
          { name: BasicBuilder.string(), enabled: true },
          { name: BasicBuilder.string(), enabled: true },
        ],
        setGlobalLevel: vi.fn(),
        enableChannel: vi.fn(),
        disableChannel: vi.fn(),
        enablePrefix: vi.fn(),
        disablePrefix: vi.fn(),
      };

      act(() => {
        subscriptionCallback?.(newState);
      });

      // Then
      expect(setSavedState).toHaveBeenCalledWith({
        globalLevel: "info",
        disabledChannels: [],
      });
    });

    it("should unsubscribe on unmount", () => {
      // Given
      const unsubscribe = vi.fn();
      mockStore.subscribe.mockReturnValue(unsubscribe);

      const { unmount } = render(
        <StudioLogsSettingsProvider>
          <div>Test</div>
        </StudioLogsSettingsProvider>,
      );

      // When
      unmount();

      // Then
      expect(unsubscribe).toHaveBeenCalled();
    });
  });

  describe("Store Recreation with Saved State Reference", () => {
    it("should use saved state reference when recreating store", () => {
      // Given
      const initialState = { globalLevel: "debug", disabledChannels: ["test"] };
      const setSavedState = vi.fn();
      const removeSavedState = vi.fn();

      // Mock useLocalStorage to return consistent value
      mockUseLocalStorage.mockReturnValue([initialState, setSavedState, removeSavedState]);

      (mockLog.channels as Mock).mockReturnValue([mockLogger]);
      mockStore.getState.mockReturnValue({
        ...defaultMockState,
        channels: [{ name: BasicBuilder.string(), enabled: true }],
      });

      // When
      render(
        <StudioLogsSettingsProvider>
          <div>Test</div>
        </StudioLogsSettingsProvider>,
      );

      // Simulate channel count change
      const newLogger = createMockLogger();
      (mockLog.channels as Mock).mockReturnValue([mockLogger, newLogger]);

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Then
      expect(mockCreateStudioLogsSettingsStore).toHaveBeenNthCalledWith(1, initialState);
      expect(mockCreateStudioLogsSettingsStore).toHaveBeenNthCalledWith(2, initialState);
    });
  });

  describe("Integration with Hook", () => {
    it("should work with context consumer hook", () => {
      // Given
      const wrapper = ({ children }: PropsWithChildren) => (
        <StudioLogsSettingsProvider>{children}</StudioLogsSettingsProvider>
      );

      // When
      const { result } = renderHook(
        () => {
          const context = useContext(StudioLogsSettingsContext);
          return context;
        },
        { wrapper },
      );

      // Then
      expect(result.current).toBe(mockStore);
    });
  });
});
