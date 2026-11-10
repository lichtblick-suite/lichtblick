/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import "@testing-library/jest-dom";
import { LayoutID } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import * as LayoutManagerContext from "@lichtblick/suite-base/context/LayoutManagerContext";
import * as useConfirmModule from "@lichtblick/suite-base/hooks/useConfirm";
import { LayoutFavorites } from "@lichtblick/suite-base/services/ILayoutManager";
import LayoutBuilder from "@lichtblick/suite-base/testing/builders/LayoutBuilder";
import { BasicBuilder } from "@lichtblick/test-builders";

import LayoutRow from "./LayoutRow";
import { ADD_TO_FAVORITES_LABEL, REMOVE_FROM_FAVORITES_LABEL } from "./constants";

// Mocks
jest.mock("@lichtblick/suite-base/context/LayoutManagerContext", () => ({
  useLayoutManager: jest.fn(),
}));
jest.mock("@lichtblick/suite-base/hooks/useConfirm", () => ({
  useConfirm: jest.fn(),
}));
jest.mock("./LayoutRow.style", () => ({
  StyledListItem: ({ children, secondaryAction }: any) => (
    <div data-testid="styled-list-item">
      {children}
      {secondaryAction}
    </div>
  ),
  StyledMenuItem: ({ children, disabled, ...props }: any) =>
    disabled === true ? (
      <button data-testid={props["data-testid"] ?? "styled-menu-item"} disabled>
        {children}
      </button>
    ) : (
      <button data-testid={props["data-testid"] ?? "styled-menu-item"} {...props}>
        {children}
      </button>
    ),
}));

const noFavorites: LayoutFavorites = { personal: new Set(), shared: new Set() };
const mockLayoutManager = {
  isOnline: true,
  supportsSharing: true,
  favorites: noFavorites,
  on: jest.fn(),
  off: jest.fn(),
  canFavorite: jest.fn().mockReturnValue(false),
  setFavorite: jest.fn().mockResolvedValue(undefined),
};
const mockConfirm = jest.fn();
const mockConfirmModal = <div data-testid="confirm-modal" />;
(LayoutManagerContext.useLayoutManager as jest.Mock).mockReturnValue(mockLayoutManager);
(useConfirmModule.useConfirm as jest.Mock).mockReturnValue([mockConfirm, mockConfirmModal]);

const layoutId = BasicBuilder.string();
const layoutName = BasicBuilder.string();
const defaultLayout = LayoutBuilder.layout({
  id: layoutId as LayoutID,
  name: layoutName,
});

const renderComponent = (props = {}) =>
  render(
    <LayoutRow
      layout={defaultLayout}
      anySelectedModifiedLayouts={false}
      multiSelectedIds={[]}
      selected={false}
      onSelect={jest.fn()}
      onRename={jest.fn()}
      onDuplicate={jest.fn()}
      onDelete={jest.fn()}
      onShare={jest.fn()}
      onExport={jest.fn()}
      onOverwrite={jest.fn()}
      onRevert={jest.fn()}
      onMakePersonalCopy={jest.fn()}
      {...props}
    />,
  );

describe("LayoutRow rendering", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("Given default props, when rendered, then displays the layout name", () => {
    // GIVEN / WHEN
    renderComponent();

    // THEN
    expect(screen.getByText(layoutName)).toBeInTheDocument();
  });

  it("Given selected=true, when rendered, then the list item is marked as selected", () => {
    // GIVEN / WHEN
    renderComponent({ selected: true });

    // THEN
    expect(screen.getByTestId("layout-list-item")).toHaveClass("Mui-selected");
  });

  it("Given a layout with a different name, when rendered, then displays that name", () => {
    // GIVEN / WHEN
    renderComponent({ layout: { ...defaultLayout, name: "Another Layout" } });

    // THEN
    expect(screen.getByText("Another Layout")).toBeInTheDocument();
  });

  it("Given multiSelectedIds includes layout id, when rendered, then the list item is marked as selected", () => {
    // GIVEN / WHEN
    renderComponent({ multiSelectedIds: [layoutId] });

    // THEN
    expect(screen.getByTestId("layout-list-item")).toHaveClass("Mui-selected");
  });

  it("when menu button is clicked then menu opens and menu items are rendered", () => {
    // GIVEN
    renderComponent();

    // WHEN
    fireEvent.click(screen.getByTestId("layout-actions"));

    // THEN
    expect(screen.getByTestId("rename-layout")).toBeInTheDocument();
    expect(screen.getByText("Export…")).toBeInTheDocument();
    expect(screen.getByTestId("delete-layout")).toBeInTheDocument();
  });

  it("when rename menu item is clicked then text field for editing name appears", async () => {
    // GIVEN
    renderComponent();
    fireEvent.click(screen.getByTestId("layout-actions"));

    // WHEN
    fireEvent.click(screen.getByTestId("rename-layout"));

    // THEN
    await waitFor(() => {
      const input = screen.getByTestId("layout-list-item").querySelector('input[type="text"]');
      expect(input).toBeInTheDocument();
    });
  });

  it("when delete menu item is clicked then confirm modal is triggered", async () => {
    // GIVEN
    mockConfirm.mockResolvedValue("ok");
    const onDelete = jest.fn();
    renderComponent({ onDelete });
    fireEvent.click(screen.getByTestId("layout-actions"));

    // WHEN
    fireEvent.click(screen.getByTestId("delete-layout"));

    // THEN
    await waitFor(() => {
      expect(screen.getByTestId("confirm-modal")).toBeInTheDocument();
    });
  });

  it("when layout has modifications then unsaved changes header and related menu items are shown", () => {
    // GIVEN
    renderComponent({ layout: { ...defaultLayout, working: {}, syncInfo: undefined } });

    // WHEN
    fireEvent.click(screen.getByTestId("layout-actions"));

    // THEN
    expect(screen.getByText("This layout has unsaved changes")).toBeInTheDocument();
    expect(screen.getByText("Save changes")).toBeInTheDocument();
    expect(screen.getByText("Revert")).toBeInTheDocument();
  });

  it("when multi-selection is active then certain actions are disabled", () => {
    // GIVEN
    renderComponent({ multiSelectedIds: [BasicBuilder.string(), BasicBuilder.string()] });

    // WHEN
    fireEvent.click(screen.getByTestId("layout-actions"));

    // THEN
    expect(screen.getByTestId("rename-layout")).toBeDisabled();
    expect(screen.getByTestId("export-layout")).toBeDisabled();
    expect(screen.getByTestId("delete-layout")).toBeEnabled();
  });

  it("Given a layout with modifications, when Revert is clicked and confirmed, then onRevert is called", async () => {
    // GIVEN
    const onRevert = jest.fn();
    mockConfirm.mockResolvedValue("ok");
    renderComponent({ layout: { ...defaultLayout, working: {}, syncInfo: undefined }, onRevert });

    // WHEN
    fireEvent.click(screen.getByTestId("layout-actions"));
    fireEvent.click(screen.getByText("Revert"));

    // THEN
    await waitFor(() => {
      expect(screen.getByTestId("confirm-modal")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(onRevert).toHaveBeenCalled();
    });
  });

  it("Given a layout with modifications, when Revert is clicked and cancelled, then onRevert is not called", async () => {
    // GIVEN
    const onRevert = jest.fn();
    mockConfirm.mockResolvedValue("cancel");
    renderComponent({ layout: { ...defaultLayout, working: {}, syncInfo: undefined }, onRevert });

    // WHEN
    fireEvent.click(screen.getByTestId("layout-actions"));
    fireEvent.click(screen.getByText("Revert"));

    // THEN
    await waitFor(() => {
      expect(screen.getByTestId("confirm-modal")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(onRevert).not.toHaveBeenCalled();
    });
  });

  it("Given a layout, when Rename is clicked and input is blurred, then onRename is called with the new name", async () => {
    // GIVEN
    const onRename = jest.fn();
    renderComponent({ onRename });
    fireEvent.click(screen.getByTestId("layout-actions"));
    fireEvent.click(screen.getByTestId("rename-layout"));
    const input = await waitFor(() =>
      screen.getByTestId("layout-list-item").querySelector('input[type="text"]'),
    );
    const inputValue = BasicBuilder.string();

    // WHEN
    fireEvent.change(input!, { target: { value: inputValue } });
    fireEvent.blur(input!);

    // THEN
    await waitFor(() => {
      expect(onRename).toHaveBeenCalledWith(expect.objectContaining({ id: layoutId }), inputValue);
    });
  });

  it("Given a shared layout, when Duplicate is clicked, then onMakePersonalCopy is called", () => {
    // GIVEN
    const onMakePersonalCopy = jest.fn();
    const sharedLayout = { ...defaultLayout, permission: "ORG_READ" as const };
    renderComponent({ layout: sharedLayout, onMakePersonalCopy });
    fireEvent.click(screen.getByTestId("layout-actions"));

    // WHEN
    fireEvent.click(screen.getByTestId("duplicate-layout"));

    // THEN
    expect(onMakePersonalCopy).toHaveBeenCalledWith(sharedLayout);
  });

  it("Given a personal layout, when Duplicate is clicked, then onDuplicate is called", () => {
    // GIVEN
    const onDuplicate = jest.fn();
    const personalLayout = {
      ...defaultLayout,
      working: undefined,
      permission: "CREATOR_WRITE",
    };
    renderComponent({ layout: personalLayout, onDuplicate });
    fireEvent.click(screen.getByTestId("layout-actions"));

    // WHEN
    fireEvent.click(screen.getByTestId("duplicate-layout"));

    // THEN
    expect(onDuplicate).toHaveBeenCalledWith(personalLayout);
  });

  it("Given a layout with modifications, when menu is opened, then duplicate option is not shown", () => {
    // GIVEN
    const layoutWithModifications = {
      ...defaultLayout,
      working: {},
      syncInfo: undefined,
      permission: "CREATOR_WRITE" as const,
    };
    renderComponent({ layout: layoutWithModifications });

    // WHEN
    fireEvent.click(screen.getByTestId("layout-actions"));

    // THEN
    expect(screen.queryByTestId("duplicate-layout")).not.toBeInTheDocument();
  });

  it("Given a shared layout, when menu is opened, then duplicate option is shown", () => {
    // GIVEN
    const sharedLayout = { ...defaultLayout, permission: "ORG_READ" as const };
    renderComponent({ layout: sharedLayout });

    // WHEN
    fireEvent.click(screen.getByTestId("layout-actions"));

    // THEN
    expect(screen.getByTestId("duplicate-layout")).toBeInTheDocument();
  });
});

describe("LayoutRow favorites", () => {
  const renderWithFavorites = (
    { canFavorite = true, favorite = false }: { canFavorite?: boolean; favorite?: boolean },
    props = {},
  ) => {
    mockLayoutManager.canFavorite.mockReturnValue(canFavorite);
    mockLayoutManager.favorites = favorite
      ? { personal: new Set([defaultLayout.id]), shared: new Set([defaultLayout.externalId!]) }
      : noFavorites;
    renderComponent(props);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockLayoutManager.isOnline = true;
  });

  afterEach(() => {
    mockLayoutManager.canFavorite.mockReturnValue(false);
    mockLayoutManager.favorites = noFavorites;
  });

  it("Given the layout cannot be favorited, when rendered, then the favorite toggle is not shown", () => {
    // GIVEN / WHEN
    renderWithFavorites({ canFavorite: false });

    // THEN
    expect(screen.queryByTestId("layout-favorite-toggle")).not.toBeInTheDocument();
  });

  it("Given a layout that is not a favorite, when rendered, then the toggle is not pressed", () => {
    // GIVEN / WHEN
    renderWithFavorites({});

    // THEN
    const toggle = screen.getByTestId("layout-favorite-toggle");
    expect(toggle).toHaveAttribute("aria-label", ADD_TO_FAVORITES_LABEL);
    expect(toggle).toHaveAttribute("aria-pressed", "false");
  });

  it("Given a layout that is not a favorite, when the toggle is clicked, then it is added to favorites", async () => {
    // GIVEN
    renderWithFavorites({});

    // WHEN
    fireEvent.click(screen.getByTestId("layout-favorite-toggle"));

    // THEN
    await waitFor(() => {
      expect(mockLayoutManager.setFavorite).toHaveBeenCalledWith(defaultLayout, { favorite: true });
    });
  });

  it("Given a favorite layout, when rendered, then the toggle is pressed", () => {
    // GIVEN / WHEN
    renderWithFavorites({ favorite: true });

    // THEN
    const toggle = screen.getByTestId("layout-favorite-toggle");
    expect(toggle).toHaveAttribute("aria-label", REMOVE_FROM_FAVORITES_LABEL);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
  });

  it("Given a favorite layout, when the toggle is clicked, then it is removed from favorites", async () => {
    // GIVEN
    renderWithFavorites({ favorite: true });

    // WHEN
    fireEvent.click(screen.getByTestId("layout-favorite-toggle"));

    // THEN
    await waitFor(() => {
      expect(mockLayoutManager.setFavorite).toHaveBeenCalledWith(defaultLayout, {
        favorite: false,
      });
    });
  });

  it("Given a rendered layout, when its favorites change, then the toggle is updated", () => {
    // GIVEN
    renderWithFavorites({});
    const favoritesListener = mockLayoutManager.on.mock.calls.find(
      ([event]) => event === "favoriteschange",
    )?.[1] as () => void;

    // WHEN
    mockLayoutManager.favorites = {
      personal: new Set([defaultLayout.id]),
      shared: new Set([defaultLayout.externalId!]),
    };
    act(() => {
      favoritesListener();
    });

    // THEN
    expect(screen.getByTestId("layout-favorite-toggle")).toHaveAttribute("aria-pressed", "true");
  });

  it("Given a shared layout while offline, when rendered, then the favorite toggle is disabled", () => {
    // GIVEN
    mockLayoutManager.isOnline = false;

    // WHEN
    renderWithFavorites({}, { layout: { ...defaultLayout, permission: "ORG_WRITE" as const } });

    // THEN
    expect(screen.getByTestId("layout-favorite-toggle")).toBeDisabled();
  });

  it("Given a personal layout while offline, when rendered, then the favorite toggle is enabled", () => {
    // GIVEN
    mockLayoutManager.isOnline = false;

    // WHEN
    renderWithFavorites({}, { layout: { ...defaultLayout, permission: "CREATOR_WRITE" as const } });

    // THEN
    expect(screen.getByTestId("layout-favorite-toggle")).toBeEnabled();
  });
});
