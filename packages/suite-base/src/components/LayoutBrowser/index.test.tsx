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

jest.mock("@lichtblick/suite-base/context/Workspace/WorkspaceContext", () => ({
  useWorkspaceStore: jest.fn(),
  WorkspaceStoreSelectors: {
    selectLayoutSectionExpanded: jest.fn(),
  },
}));

jest.mock("@lichtblick/suite-base/context/Workspace/useWorkspaceActions", () => ({
  useWorkspaceActions: jest.fn(),
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
    (useWorkspaceStore as jest.Mock).mockReturnValue({ personal: true, shared: true });
    (useWorkspaceActions as jest.Mock).mockReturnValue({
      layoutBrowserActions: {
        setPersonalSectionExpanded: jest.fn(),
        setSharedSectionExpanded: jest.fn(),
      },
    });
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

  describe("section collapse persistence", () => {
    let setPersonalExpandedMock: jest.Mock;
    let setSharedExpandedMock: jest.Mock;
    let onSelectLayoutMock: jest.Mock;
    let logEventMock: jest.Mock;

    const originalLayoutSectionMock = jest.requireMock("./LayoutSection").default;

    beforeEach(() => {
      setPersonalExpandedMock = jest.fn();
      setSharedExpandedMock = jest.fn();
      onSelectLayoutMock = jest.fn().mockResolvedValue(undefined);
      logEventMock = jest.fn().mockResolvedValue(undefined);

      (useAnalytics as jest.Mock).mockReturnValue({ logEvent: logEventMock });
      (useWorkspaceStore as jest.Mock).mockReturnValue({ personal: true, shared: true });
      (useWorkspaceActions as jest.Mock).mockReturnValue({
        layoutBrowserActions: {
          setPersonalSectionExpanded: setPersonalExpandedMock,
          setSharedSectionExpanded: setSharedExpandedMock,
        },
      });
      (useLayoutNavigation as jest.Mock).mockReturnValue({
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
      jest.requireMock("./LayoutSection").default = originalLayoutSectionMock;
    });

    it("passes expanded state and toggle handlers to LayoutSection", () => {
      // GIVEN
      (useWorkspaceStore as jest.Mock).mockReturnValue({ personal: false, shared: true });

      const capturedProps: Record<string, unknown>[] = [];
      jest.requireMock("./LayoutSection").default = jest
        .fn()
        .mockImplementation((props: Record<string, unknown>) => {
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
      jest.requireMock("./LayoutSection").default = jest
        .fn()
        .mockImplementation((props: { onToggleExpanded?: () => void }) => {
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
      jest.requireMock("./LayoutSection").default = jest
        .fn()
        .mockImplementation((props: { onToggleExpanded?: () => void }) => {
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
      mockLayoutManager.saveNewLayout = jest.fn().mockResolvedValue(newLayout);
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
      const promptMock = jest.fn().mockResolvedValue("Shared Layout");
      (usePrompt as jest.Mock).mockReturnValue([promptMock, undefined]);
      mockLayoutManager.saveNewLayout = jest.fn().mockResolvedValue(newLayout);

      let capturedOnShare: ((item: Layout) => void) | undefined;
      jest.requireMock("./LayoutSection").default = jest
        .fn()
        .mockImplementation((props: { onShare: (item: Layout) => void }) => {
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
      mockLayoutManager.makePersonalCopy = jest.fn().mockResolvedValue(newLayout);

      let capturedOnMakePersonalCopy: ((item: Layout) => void) | undefined;
      jest.requireMock("./LayoutSection").default = jest
        .fn()
        .mockImplementation((props: { onMakePersonalCopy: (item: Layout) => void }) => {
          capturedOnMakePersonalCopy = props.onMakePersonalCopy;
          return <div data-testid="layout-section" />;
        });

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
