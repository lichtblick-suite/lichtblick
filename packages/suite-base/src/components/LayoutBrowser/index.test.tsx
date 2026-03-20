/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

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

jest.mock("notistack", () => ({
  useSnackbar: jest.fn().mockReturnValue({ enqueueSnackbar: jest.fn() }),
}));

jest.mock("@lichtblick/suite-base/context/LayoutManagerContext", () => ({
  useLayoutManager: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/context/AnalyticsContext", () => ({
  useAnalytics: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/context/CurrentLayoutContext", () => ({
  useCurrentLayoutSelector: jest.fn(),
  useCurrentLayoutActions: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/context/CurrentUserContext", () => ({
  useCurrentUser: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/hooks/useLayoutNavigation", () => ({
  useLayoutNavigation: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/hooks/useConfirm", () => ({
  useConfirm: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/hooks/usePrompt", () => ({
  usePrompt: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/hooks/useAppConfigurationValue", () => ({
  useAppConfigurationValue: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/hooks/useLayoutTransfer", () => ({
  useLayoutTransfer: jest.fn().mockReturnValue({
    importLayout: jest.fn(),
    exportLayout: jest.fn(),
  }),
}));

jest.mock("@lichtblick/suite-base/hooks/useCallbackWithToast", () => ({
  __esModule: true,
  default: <Args extends unknown[]>(fn: (...args: Args) => Promise<void>) => fn,
}));

jest.mock("@lichtblick/suite-base/hooks/useLayoutActions", () => ({
  useLayoutActions: jest.fn().mockReturnValue({
    onRenameLayout: jest.fn(),
    onDuplicateLayout: jest.fn(),
    onDeleteLayout: jest.fn(),
    onRevertLayout: jest.fn(),
    onOverwriteLayout: jest.fn(),
    confirmModal: undefined,
  }),
}));

jest.mock("./LayoutSection", () => ({
  __esModule: true,
  default: () => <div data-testid="layout-section" />,
}));

jest.mock("@lichtblick/suite-base/components/SidebarContent", () => ({
  SidebarContent: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <div data-testid="sidebar-content">
      <span>{title}</span>
      {children}
    </div>
  ),
}));

describe("LayoutBrowser", () => {
  const mockLayoutManager = new MockLayoutManager();
  let dispatchMock: jest.Mock;

  const ids = [BasicBuilder.string(), BasicBuilder.string()];

  beforeEach(() => {
    dispatchMock = jest.fn();
    (useLayoutManager as jest.Mock).mockReturnValue(mockLayoutManager);
    (useAnalytics as jest.Mock).mockReturnValue({ logEvent: jest.fn() });
    (useCurrentLayoutSelector as jest.Mock).mockReturnValue(undefined);
    (useCurrentLayoutActions as jest.Mock).mockReturnValue({ setSelectedLayoutId: jest.fn() });
    (useCurrentUser as jest.Mock).mockReturnValue({ signIn: undefined });
    (useConfirm as jest.Mock).mockReturnValue([jest.fn(), undefined]);
    (usePrompt as jest.Mock).mockReturnValue([jest.fn(), undefined]);
    (useAppConfigurationValue as jest.Mock).mockReturnValue([true, jest.fn()]);
    (useLayoutNavigation as jest.Mock).mockReturnValue({
      onSelectLayout: jest.fn(),
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
    jest.clearAllMocks();
  });

  it("renders without crashing", () => {
    render(<LayoutBrowser />);
    expect(screen.getByTestId("sidebar-content")).toBeInTheDocument();
  });

  describe("processAction useEffect", () => {
    let enqueueSnackbarMock: jest.Mock;

    const renderWithMultiAction = (multiAction: LayoutSelectionState["multiAction"]) => {
      (useLayoutNavigation as jest.Mock).mockReturnValue({
        onSelectLayout: jest.fn(),
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

    beforeEach(() => {
      enqueueSnackbarMock = jest.fn();
      (jest.requireMock("notistack").useSnackbar as jest.Mock).mockReturnValue({
        enqueueSnackbar: enqueueSnackbarMock,
      });
      mockLayoutManager.deleteLayout = jest.fn().mockResolvedValue(undefined);
      mockLayoutManager.revertLayout = jest.fn().mockResolvedValue(undefined);
      mockLayoutManager.overwriteLayout = jest.fn().mockResolvedValue(undefined);
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
        expect(mockLayoutManager.revertLayout).toHaveBeenCalledTimes(2);
      });
      expect(mockLayoutManager.revertLayout).toHaveBeenCalledWith({ id: ids[0] });
      expect(mockLayoutManager.revertLayout).toHaveBeenCalledWith({ id: ids[1] });
      expect(dispatchMock).toHaveBeenCalledWith({ type: "shift-multi-action" });
    });

    it("calls deleteLayout for each id and dispatches shift-multi-action", async () => {
      // WHEN
      renderWithMultiAction({ action: "delete", ids });

      // THEN
      await waitFor(() => {
        expect(mockLayoutManager.deleteLayout).toHaveBeenCalledTimes(2);
      });
      expect(mockLayoutManager.deleteLayout).toHaveBeenCalledWith({ id: ids[0] });
      expect(mockLayoutManager.deleteLayout).toHaveBeenCalledWith({ id: ids[1] });
      expect(dispatchMock).toHaveBeenCalledWith({ type: "shift-multi-action" });
    });

    it("calls overwriteLayout for each id and dispatches shift-multi-action on save action", async () => {
      // WHEN
      renderWithMultiAction({ action: "save", ids });

      // THEN
      await waitFor(() => {
        expect(mockLayoutManager.overwriteLayout).toHaveBeenCalledTimes(2);
      });
      expect(mockLayoutManager.overwriteLayout).toHaveBeenCalledWith({ id: ids[0] });
      expect(mockLayoutManager.overwriteLayout).toHaveBeenCalledWith({ id: ids[1] });
      expect(dispatchMock).toHaveBeenCalledWith({ type: "shift-multi-action" });
    });

    it("calls getLayout then saveNewLayout for each id on duplicate action", async () => {
      // GIVEN
      const layout = LayoutBuilder.layout({ id: "id1" as LayoutID });
      mockLayoutManager.getLayout = jest.fn().mockResolvedValue(layout);
      mockLayoutManager.saveNewLayout = jest.fn().mockResolvedValue(LayoutBuilder.layout());

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
      mockLayoutManager.revertLayout = jest.fn().mockRejectedValue(new Error(errorMessage));

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
