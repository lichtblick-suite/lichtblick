/** @vitest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { Mock } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { LayoutSelectionState } from "@lichtblick/suite-base/components/LayoutBrowser/types";
import { useAnalytics } from "@lichtblick/suite-base/context/AnalyticsContext";
import {
  LayoutID,
  useCurrentLayoutSelector,
  useCurrentLayoutActions,
} from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { useCurrentUser } from "@lichtblick/suite-base/context/CurrentUserContext";
import { useLayoutManager } from "@lichtblick/suite-base/context/LayoutManagerContext";
import { useAppConfigurationValue } from "@lichtblick/suite-base/hooks/useAppConfigurationValue";
import { useConfirm } from "@lichtblick/suite-base/hooks/useConfirm";
import { useLayoutNavigation } from "@lichtblick/suite-base/hooks/useLayoutNavigation";
import { usePrompt } from "@lichtblick/suite-base/hooks/usePrompt";
import MockLayoutManager from "@lichtblick/suite-base/services/LayoutManager/MockLayoutManager";
import LayoutBuilder from "@lichtblick/suite-base/testing/builders/LayoutBuilder";
import { BasicBuilder } from "@lichtblick/test-builders";

import LayoutBrowser from "./index";

vi.mock("notistack", async () => ({
  useSnackbar: vi.fn().mockReturnValue({ enqueueSnackbar: vi.fn() }),
}));

vi.mock("@lichtblick/suite-base/context/LayoutManagerContext", async () => ({
  useLayoutManager: vi.fn(),
}));

vi.mock("@lichtblick/suite-base/context/AnalyticsContext", async () => ({
  useAnalytics: vi.fn(),
}));

vi.mock("@lichtblick/suite-base/context/CurrentLayoutContext", async () => ({
  useCurrentLayoutSelector: vi.fn(),
  useCurrentLayoutActions: vi.fn(),
}));

vi.mock("@lichtblick/suite-base/context/CurrentUserContext", async () => ({
  useCurrentUser: vi.fn(),
}));

vi.mock("@lichtblick/suite-base/hooks/useLayoutNavigation", async () => ({
  useLayoutNavigation: vi.fn(),
}));

vi.mock("@lichtblick/suite-base/hooks/useConfirm", async () => ({
  useConfirm: vi.fn(),
}));

vi.mock("@lichtblick/suite-base/hooks/usePrompt", async () => ({
  usePrompt: vi.fn(),
}));

vi.mock("@lichtblick/suite-base/hooks/useAppConfigurationValue", async () => ({
  useAppConfigurationValue: vi.fn(),
}));

vi.mock("@lichtblick/suite-base/hooks/useLayoutTransfer", async () => ({
  useLayoutTransfer: vi.fn().mockReturnValue({
    importLayout: vi.fn(),
    exportLayout: vi.fn(),
  }),
}));

vi.mock("@lichtblick/suite-base/hooks/useCallbackWithToast", async () => ({
  __esModule: true,
  default: <Args extends unknown[]>(fn: (...args: Args) => Promise<void>) => fn,
}));

vi.mock("@lichtblick/suite-base/hooks/useLayoutActions", async () => ({
  useLayoutActions: vi.fn().mockReturnValue({
    onRenameLayout: vi.fn(),
    onDuplicateLayout: vi.fn(),
    onDeleteLayout: vi.fn(),
    onRevertLayout: vi.fn(),
    onOverwriteLayout: vi.fn(),
    confirmModal: undefined,
  }),
}));

vi.mock("./LayoutSection", async () => ({
  __esModule: true,
  default: () => <div data-testid="layout-section" />,
}));

vi.mock("@lichtblick/suite-base/components/SidebarContent", async () => ({
  SidebarContent: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <div data-testid="sidebar-content">
      <span>{title}</span>
      {children}
    </div>
  ),
}));

describe("LayoutBrowser", () => {
  const mockLayoutManager = new MockLayoutManager();
  let dispatchMock: Mock;

  const ids = [BasicBuilder.string(), BasicBuilder.string()];

  beforeEach(() => {
    dispatchMock = vi.fn();
    (useLayoutManager as Mock).mockReturnValue(mockLayoutManager);
    (useAnalytics as Mock).mockReturnValue({ logEvent: vi.fn() });
    (useCurrentLayoutSelector as Mock).mockReturnValue(undefined);
    (useCurrentLayoutActions as Mock).mockReturnValue({ setSelectedLayoutId: vi.fn() });
    (useCurrentUser as Mock).mockReturnValue({ signIn: undefined });
    (useConfirm as Mock).mockReturnValue([vi.fn(), undefined]);
    (usePrompt as Mock).mockReturnValue([vi.fn(), undefined]);
    (useAppConfigurationValue as Mock).mockReturnValue([true, vi.fn()]);
    (useLayoutNavigation as Mock).mockReturnValue({
      onSelectLayout: vi.fn(),
      state: {
        busy: false,
        error: undefined,
        online: true,
        lastSelectedId: undefined,
        multiAction: undefined,
        selectedIds: [],
      },
      dispatch: dispatchMock,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing", () => {
    render(<LayoutBrowser />);
    expect(screen.getByTestId("sidebar-content")).toBeInTheDocument();
  });

  describe("processAction useEffect", () => {
    let enqueueSnackbarMock: Mock;

    const renderWithMultiAction = (multiAction: LayoutSelectionState["multiAction"]) => {
      (useLayoutNavigation as Mock).mockReturnValue({
        onSelectLayout: vi.fn(),
        state: {
          busy: false,
          error: undefined,
          online: true,
          lastSelectedId: undefined,
          multiAction,
          selectedIds: [],
        },
        dispatch: dispatchMock,
      });
      return render(<LayoutBrowser />);
    };

    beforeEach(async () => {
      enqueueSnackbarMock = vi.fn();
      const notistack = await vi.importMock<typeof import("notistack")>("notistack");
      (notistack.useSnackbar as Mock).mockReturnValue({
        enqueueSnackbar: enqueueSnackbarMock,
      });
      mockLayoutManager.deleteLayout = vi.fn().mockResolvedValue(undefined);
      mockLayoutManager.revertLayout = vi.fn().mockResolvedValue(undefined);
      mockLayoutManager.overwriteLayout = vi.fn().mockResolvedValue(undefined);
    });

    it("does nothing when multiAction is undefined", () => {
      renderWithMultiAction(undefined);

      expect(mockLayoutManager.revertLayout).not.toHaveBeenCalled();
      expect(mockLayoutManager.deleteLayout).not.toHaveBeenCalled();
      expect(mockLayoutManager.overwriteLayout).not.toHaveBeenCalled();
      expect(mockLayoutManager.saveNewLayout).not.toHaveBeenCalled();
    });

    it("calls revertLayout for each id and dispatches shift-multi-action", async () => {
      // WHEN
      renderWithMultiAction({ action: "revert", ids });

      // THEN
      await waitFor(() => {
        expect(mockLayoutManager.revertLayout).toHaveBeenCalledTimes(1);
      });
      expect(mockLayoutManager.revertLayout).toHaveBeenCalledWith({ id: ids[0] });
      expect(dispatchMock).toHaveBeenCalledWith({ type: "shift-multi-action" });
    });

    it("calls deleteLayout for each id and dispatches shift-multi-action", async () => {
      // WHEN
      renderWithMultiAction({ action: "delete", ids });

      // THEN
      await waitFor(() => {
        expect(mockLayoutManager.deleteLayout).toHaveBeenCalledTimes(1);
      });
      expect(mockLayoutManager.deleteLayout).toHaveBeenCalledWith({ id: ids[0] });
      expect(dispatchMock).toHaveBeenCalledWith({ type: "shift-multi-action" });
    });

    it("calls overwriteLayout for each id and dispatches shift-multi-action on save action", async () => {
      // WHEN
      renderWithMultiAction({ action: "save", ids });

      // THEN
      await waitFor(() => {
        expect(mockLayoutManager.overwriteLayout).toHaveBeenCalledTimes(1);
      });
      expect(mockLayoutManager.overwriteLayout).toHaveBeenCalledWith({ id: ids[0] });
      expect(dispatchMock).toHaveBeenCalledWith({ type: "shift-multi-action" });
    });

    it("calls getLayout then saveNewLayout for each id on duplicate action", async () => {
      // GIVEN
      const layout = LayoutBuilder.layout({ id: "id1" as LayoutID });
      mockLayoutManager.getLayout = vi.fn().mockResolvedValue(layout);
      mockLayoutManager.saveNewLayout = vi.fn().mockResolvedValue(LayoutBuilder.layout());

      // WHEN
      renderWithMultiAction({ action: "duplicate", ids: ["id1"] });

      // THEN
      await waitFor(() => {
        expect(mockLayoutManager.getLayout).toHaveBeenCalledWith("id1");
      });
      expect(mockLayoutManager.saveNewLayout).toHaveBeenCalledWith({
        name: `${layout.name} copy`,
        data: layout.working?.data ?? layout.baseline.data,
        permission: "CREATOR_WRITE",
      });
      expect(dispatchMock).toHaveBeenCalledWith({ type: "shift-multi-action" });
    });

    it("shows error snackbar and dispatches clear-multi-action on failure", async () => {
      // GIVEN
      const errorMessage = "Something went wrong";
      mockLayoutManager.revertLayout = vi.fn().mockRejectedValue(new Error(errorMessage));

      // WHEN
      renderWithMultiAction({ action: "revert", ids: ["id1"] });

      // THEN
      await waitFor(() => {
        expect(enqueueSnackbarMock).toHaveBeenCalledWith(
          `Error processing layouts: ${errorMessage}`,
          { variant: "error" },
        );
      });
      expect(dispatchMock).toHaveBeenCalledWith({ type: "clear-multi-action" });
    });
  });
});
