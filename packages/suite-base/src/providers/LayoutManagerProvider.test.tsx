/** @vitest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { render, waitFor } from "@testing-library/react";
import { useNetworkState } from "react-use";
import type { Mock } from "vitest";

import { useVisibilityState } from "@lichtblick/hooks";
import { useLayoutStorage } from "@lichtblick/suite-base/context/LayoutStorageContext";
import { useRemoteLayoutStorage } from "@lichtblick/suite-base/context/RemoteLayoutStorageContext";
import LayoutManagerProvider from "@lichtblick/suite-base/providers/LayoutManagerProvider";
import MockLayoutManager from "@lichtblick/suite-base/services/LayoutManager/MockLayoutManager";

// Mock dependencies
vi.mock("react-use");
vi.mock("@lichtblick/hooks");
vi.mock("@lichtblick/suite-base/context/LayoutStorageContext");
vi.mock("@lichtblick/suite-base/context/RemoteLayoutStorageContext");

const mockLayoutManager = new MockLayoutManager();

vi.mock("@lichtblick/suite-base/services/LayoutManager/LayoutManager", async () => ({
  default: vi.fn(() => mockLayoutManager),
}));

describe("LayoutManagerProvider", () => {
  // Mock necessary hooks to render <LayoutManagerProvider /> component, otherwise it will fail
  (useNetworkState as Mock).mockReturnValue({ online: true });
  (useVisibilityState as Mock).mockReturnValue("visible");
  (useLayoutStorage as Mock).mockReturnValue({});
  (useRemoteLayoutStorage as Mock).mockReturnValue({});

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call layoutManager.setOnline accordingly with useNetworkState", async () => {
    (useNetworkState as Mock).mockResolvedValueOnce({ online: false });

    // 1 render with true and another with false.
    render(<LayoutManagerProvider />);
    render(<LayoutManagerProvider />);

    await waitFor(() => {
      expect(mockLayoutManager.setOnline).toHaveBeenCalledTimes(2);
      expect(mockLayoutManager.setOnline).toHaveBeenCalledWith({ online: true });
      expect(mockLayoutManager.setOnline).toHaveBeenCalledWith({ online: false });
    });
  });

  it("should call layoutManager.syncWithRemote", async () => {
    render(<LayoutManagerProvider />);

    await waitFor(() => {
      expect(mockLayoutManager.syncWithRemote).toHaveBeenCalledTimes(1);
    });
  });

  it("should not call layoutManager.syncWithRemote if offline", async () => {
    (useNetworkState as Mock).mockReturnValueOnce({ online: false });

    render(<LayoutManagerProvider />);

    await waitFor(() => {
      expect(mockLayoutManager.syncWithRemote).toHaveBeenCalledTimes(0);
    });
  });

  it("should not call layoutManager.syncWithRemote if not visible", async () => {
    (useVisibilityState as Mock).mockReturnValueOnce("invisible");

    render(<LayoutManagerProvider />);

    await waitFor(() => {
      expect(mockLayoutManager.syncWithRemote).toHaveBeenCalledTimes(0);
    });
  });

  it("should not call layoutManager.syncWithRemote if there is not remote storage", async () => {
    (useRemoteLayoutStorage as Mock).mockReturnValueOnce(undefined);

    render(<LayoutManagerProvider />);

    await waitFor(() => {
      expect(mockLayoutManager.syncWithRemote).toHaveBeenCalledTimes(0);
    });
  });
});
