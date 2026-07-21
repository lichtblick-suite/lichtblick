/** @vitest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { render, screen, waitFor } from "@testing-library/react";
import type { Mock } from "vitest";
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
import { useWorkspaceStore } from "@lichtblick/suite-base/context/Workspace/WorkspaceContext";
import { useWorkspaceActions } from "@lichtblick/suite-base/context/Workspace/useWorkspaceActions";
import { useAppConfigurationValue } from "@lichtblick/suite-base/hooks/useAppConfigurationValue";
import { useConfirm } from "@lichtblick/suite-base/hooks/useConfirm";
import { useLayoutNavigation } from "@lichtblick/suite-base/hooks/useLayoutNavigation";
import { usePrompt } from "@lichtblick/suite-base/hooks/usePrompt";
import { Layout } from "@lichtblick/suite-base/services/ILayoutStorage";
import MockLayoutManager from "@lichtblick/suite-base/services/LayoutManager/MockLayoutManager";
import LayoutBuilder from "@lichtblick/suite-base/testing/builders/LayoutBuilder";
import { BasicBuilder } from "@lichtblick/test-builders";

import LayoutSection from "./LayoutSection";
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

vi.mock("@lichtblick/suite-base/context/Workspace/WorkspaceContext", async () => ({
  useWorkspaceStore: vi.fn(),
  WorkspaceStoreSelectors: {
    selectLayoutSectionExpanded: vi.fn(),
  },
}));

vi.mock("@lichtblick/suite-base/context/Workspace/useWorkspaceActions", async () => ({
  useWorkspaceActions: vi.fn(),
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
  default: vi.fn(() => <div data-testid="layout-section" />),
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
    (useWorkspaceStore as Mock).mockReturnValue({ personal: true, shared: true });
    (useWorkspaceActions as Mock).mockReturnValue({
      layoutBrowserActions: {
        setPersonalSectionExpanded: vi.fn(),
        setSharedSectionExpanded: vi.fn(),
      },
    });
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

  describe("section collapse persistence", () => {
    let setPersonalExpandedMock: Mock;
    let setSharedExpandedMock: Mock;
    let onSelectLayoutMock: Mock;
    let logEventMock: Mock;

    const originalLayoutSectionMock = (LayoutSection as Mock).getMockImplementation();

    beforeEach(() => {
      setPersonalExpandedMock = vi.fn();
      setSharedExpandedMock = vi.fn();
      onSelectLayoutMock = vi.fn().mockResolvedValue(undefined);
      logEventMock = vi.fn().mockResolvedValue(undefined);

      (useAnalytics as Mock).mockReturnValue({ logEvent: logEventMock });
      (useWorkspaceStore as Mock).mockReturnValue({ personal: true, shared: true });
      (useWorkspaceActions as Mock).mockReturnValue({
        layoutBrowserActions: {
          setPersonalSectionExpanded: setPersonalExpandedMock,
          setSharedSectionExpanded: setSharedExpandedMock,
        },
      });
      (useLayoutNavigation as Mock).mockReturnValue({
        onSelectLayout: onSelectLayoutMock,
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
      (LayoutSection as Mock).mockImplementation(
        originalLayoutSectionMock ?? (() => <div data-testid="layout-section" />),
      );
    });

    it("passes expanded state and toggle handlers to LayoutSection", () => {
      // GIVEN
      (useWorkspaceStore as Mock).mockReturnValue({ personal: false, shared: true });

      const capturedProps: Record<string, unknown>[] = [];
      (LayoutSection as Mock).mockImplementation((props: Record<string, unknown>) => {
        capturedProps.push(props);
        return <div data-testid="layout-section" />;
      });

      // WHEN
      render(<LayoutBrowser />);

      // THEN
      expect(capturedProps[0]?.expanded).toBe(false);
      expect(capturedProps[0]?.onToggleExpanded).toBeDefined();
    });

    it("calls setPersonalSectionExpanded with toggler when togglePersonalExpanded is invoked", () => {
      // GIVEN
      let capturedOnToggle: (() => void) | undefined;
      (LayoutSection as Mock).mockImplementation((props: { onToggleExpanded?: () => void }) => {
        if (!capturedOnToggle && props.onToggleExpanded) {
          capturedOnToggle = props.onToggleExpanded;
        }
        return <div data-testid="layout-section" />;
      });

      render(<LayoutBrowser />);

      // WHEN
      capturedOnToggle!();

      // THEN
      expect(setPersonalExpandedMock).toHaveBeenCalledTimes(1);
      expect(setPersonalExpandedMock).toHaveBeenCalledWith(expect.any(Function));
    });

    it("calls setSharedSectionExpanded with toggler when toggleSharedExpanded is invoked", () => {
      // GIVEN
      mockLayoutManager.supportsSharing = true;

      const capturedOnToggles: (() => void)[] = [];
      (LayoutSection as Mock).mockImplementation((props: { onToggleExpanded?: () => void }) => {
        if (props.onToggleExpanded) {
          capturedOnToggles.push(props.onToggleExpanded);
        }
        return <div data-testid="layout-section" />;
      });

      render(<LayoutBrowser />);

      // WHEN - second LayoutSection is the shared one
      const sharedToggle = capturedOnToggles[1];
      sharedToggle!();

      // THEN
      expect(setSharedExpandedMock).toHaveBeenCalledTimes(1);
      expect(setSharedExpandedMock).toHaveBeenCalledWith(expect.any(Function));
    });

    it("expands personal section when creating a new layout", async () => {
      // GIVEN
      const newLayout = LayoutBuilder.layout();
      mockLayoutManager.saveNewLayout = vi.fn().mockResolvedValue(newLayout);
      render(<LayoutBrowser currentDateForStorybook={new Date("2025-01-01")} />);

      // WHEN - simulate createNewLayout by clicking the button
      const createBtn = screen.getByTestId("create-new-layout");
      createBtn.click();

      // THEN
      await waitFor(() => {
        expect(setPersonalExpandedMock).toHaveBeenCalledWith(true);
      });
    });

    it("expands shared section when sharing a layout", async () => {
      // GIVEN
      const layout = LayoutBuilder.layout();
      const newLayout = LayoutBuilder.layout();
      const promptMock = vi.fn().mockResolvedValue("Shared Layout");
      (usePrompt as Mock).mockReturnValue([promptMock, undefined]);
      mockLayoutManager.saveNewLayout = vi.fn().mockResolvedValue(newLayout);

      let capturedOnShare: ((item: Layout) => void) | undefined;
      (LayoutSection as Mock).mockImplementation((props: { onShare: (item: Layout) => void }) => {
        capturedOnShare = props.onShare;
        return <div data-testid="layout-section" />;
      });

      render(<LayoutBrowser />);

      // WHEN
      capturedOnShare!(layout);

      // THEN
      await waitFor(() => {
        expect(setSharedExpandedMock).toHaveBeenCalledWith(true);
      });
    });

    it("expands personal section when making a personal copy", async () => {
      // GIVEN
      const layout = LayoutBuilder.layout();
      const newLayout = LayoutBuilder.layout();
      mockLayoutManager.makePersonalCopy = vi.fn().mockResolvedValue(newLayout);

      let capturedOnMakePersonalCopy: ((item: Layout) => void) | undefined;
      (LayoutSection as Mock).mockImplementation(
        (props: { onMakePersonalCopy: (item: Layout) => void }) => {
          capturedOnMakePersonalCopy = props.onMakePersonalCopy;
          return <div data-testid="layout-section" />;
        },
      );

      render(<LayoutBrowser />);

      // WHEN
      capturedOnMakePersonalCopy!(layout);

      // THEN
      await waitFor(() => {
        expect(setPersonalExpandedMock).toHaveBeenCalledWith(true);
      });
    });
  });
});
