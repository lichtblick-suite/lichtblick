/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { act, render, renderHook } from "@testing-library/react";
import "@testing-library/jest-dom";
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

jest.mock("react-use", () => ({
  useLocalStorage: jest.fn(),
}));

jest.mock("@lichtblick/log");

jest.mock("./store", () => ({
  createStudioLogsSettingsStore: jest.fn(),
}));

const mockUseLocalStorage = useLocalStorage as jest.MockedFunction<typeof useLocalStorage>;
const mockLog = Log as jest.Mocked<typeof Log>;
const mockCreateStudioLogsSettingsStore = createStudioLogsSettingsStore as jest.MockedFunction<
  typeof createStudioLogsSettingsStore
>;

describe("StudioLogsSettingsProvider", () => {
  const mockStore = {
    getState: jest.fn<IStudioLogsSettings, []>(),
    setState: jest.fn(),
    subscribe: jest.fn<() => void, [(state: IStudioLogsSettings) => void]>(),
    destroy: jest.fn(),
    getInitialState: jest.fn<IStudioLogsSettings, []>(),
  };

  const createMockLogger = (): Partial<any> => ({
    name: jest.fn().mockReturnValue("test-logger"),
    setLevel: jest.fn(),
    isLevelOn: jest.fn().mockReturnValue(true),
    getLevel: jest.fn().mockReturnValue("info"),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  });

  const mockLogger = createMockLogger();

  const defaultMockState: IStudioLogsSettings = {
    channels: [{ name: BasicBuilder.string(), enabled: true }],
    globalLevel: "info",
    setGlobalLevel: jest.fn(),
    enableChannel: jest.fn(),
    disableChannel: jest.fn(),
    enablePrefix: jest.fn(),
    disablePrefix: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockUseLocalStorage.mockReturnValue([{}, jest.fn(), jest.fn()]);
    (mockLog.channels as jest.Mock).mockReturnValue([mockLogger]);
    (mockCreateStudioLogsSettingsStore as jest.Mock).mockReturnValue(mockStore);
    mockStore.getState.mockReturnValue(defaultMockState);
    mockStore.subscribe.mockReturnValue(jest.fn());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("Component Initialization", () => {
    it("should initialize with empty local storage state", () => {
      // Given
      const setSavedState = jest.fn();
      const removeSavedState = jest.fn();
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
      const setSavedState = jest.fn();
      const removeSavedState = jest.fn();
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
      (mockLog.channels as jest.Mock).mockReturnValue([mockLogger]);
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
      (mockLog.channels as jest.Mock).mockReturnValue([mockLogger, newLogger]);

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      // Then
      expect(mockCreateStudioLogsSettingsStore).toHaveBeenCalledTimes(2);
    });

    it("should not recreate store when channel count remains same", () => {
      // Given
      (mockLog.channels as jest.Mock).mockReturnValue([mockLogger]);
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
        jest.advanceTimersByTime(2000);
      });

      // Then
      expect(mockCreateStudioLogsSettingsStore).toHaveBeenCalledTimes(1);
    });

    it("should clean up interval on unmount", () => {
      // Given
      const clearIntervalSpy = jest.spyOn(global, "clearInterval");
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
      const setSavedState = jest.fn();
      const removeSavedState = jest.fn();
      mockUseLocalStorage.mockReturnValue([{}, setSavedState, removeSavedState]);
      mockStore.subscribe.mockImplementation((callback: (state: IStudioLogsSettings) => void) => {
        subscriptionCallback = callback;
        return jest.fn(); // unsubscribe function
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
        setGlobalLevel: jest.fn(),
        enableChannel: jest.fn(),
        disableChannel: jest.fn(),
        enablePrefix: jest.fn(),
        disablePrefix: jest.fn(),
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
      const setSavedState = jest.fn();
      const removeSavedState = jest.fn();
      mockUseLocalStorage.mockReturnValue([{}, setSavedState, removeSavedState]);
      mockStore.subscribe.mockImplementation((callback: (state: IStudioLogsSettings) => void) => {
        subscriptionCallback = callback;
        return jest.fn();
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
        setGlobalLevel: jest.fn(),
        enableChannel: jest.fn(),
        disableChannel: jest.fn(),
        enablePrefix: jest.fn(),
        disablePrefix: jest.fn(),
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
      const unsubscribe = jest.fn();
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
      const setSavedState = jest.fn();
      const removeSavedState = jest.fn();

      // Mock useLocalStorage to return consistent value
      mockUseLocalStorage.mockReturnValue([initialState, setSavedState, removeSavedState]);

      (mockLog.channels as jest.Mock).mockReturnValue([mockLogger]);
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
      (mockLog.channels as jest.Mock).mockReturnValue([mockLogger, newLogger]);

      act(() => {
        jest.advanceTimersByTime(1000);
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
