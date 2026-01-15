/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { render, screen } from "@testing-library/react";

import { NewSidebar } from "@lichtblick/suite-base/components/Sidebars/NewSidebar";
import { NewSidebarProps, SidebarItem } from "@lichtblick/suite-base/components/Sidebars/types";
import { BasicBuilder } from "@lichtblick/test-builders";

describe("NewSidebar", () => {
  function buildSidebarItem(props: Partial<SidebarItem> = {}): SidebarItem {
    const title = BasicBuilder.string();
    return {
      title,
      component: () => <div>Component of {title}</div>,
      ...props,
    };
  }

  function buildSidebarItems(): {
    tabs: string[];
    items: Map<string, SidebarItem>;
    sidebarItems: SidebarItem[];
  } {
    const tabs = BasicBuilder.strings();
    const items = new Map<string, SidebarItem>();
    tabs.forEach((tab) => {
      items.set(tab, buildSidebarItem());
    });
    const sidebarItems = tabs.map((tab) => items.get(tab)!);

    return {
      tabs,
      items,
      sidebarItems,
    };
  }

  const renderComponent = (propsOverride: Partial<NewSidebarProps<string>> = {}) => {
    const { tabs, items, sidebarItems } = buildSidebarItems();
    const props: NewSidebarProps<string> = {
      activeTab: tabs[0],
      anchor: BasicBuilder.sample(["left", "right"]),
      items,
      onClose: jest.fn(),
      setActiveTab: jest.fn(),
      ...propsOverride,
    };

    const ui: React.ReactElement = <NewSidebar {...props} />;

    const renderObj = render(ui);

    return {
      ...renderObj,
      props,
      sidebarItems,
      tabs,
      rerender: (newPropsOverride: Partial<NewSidebarProps<string>> = {}) => {
        renderObj.rerender(<NewSidebar {...props} {...newPropsOverride} />);
      },
    };
  };

  it("should render the title and component of the sidebarItem", () => {
    const activeTab = BasicBuilder.string();
    const items = new Map<string, SidebarItem>();
    items.set(activeTab, buildSidebarItem());

    renderComponent({ items, activeTab });

    const item = items.get(activeTab)!;
    expect(screen.getByText(item.title)).toBeDefined();
    expect(screen.getByText(`Component of ${item.title}`)).toBeDefined();
  });

  it("should render the all titles, but only the selected component", () => {
    const { rerender, tabs, sidebarItems } = renderComponent();

    // All titles are in the screen
    expect(screen.getByText(sidebarItems[0]!.title)).toBeDefined();
    expect(screen.getByText(sidebarItems[1]!.title)).toBeDefined();
    expect(screen.getByText(sidebarItems[2]!.title)).toBeDefined();

    // Only the first component is rendered
    expect(screen.getByText(`Component of ${sidebarItems[0]!.title}`)).toBeDefined();
    expect(() => screen.getByText(`Component of ${sidebarItems[1]!.title}`)).toThrow();
    expect(() => screen.getByText(`Component of ${sidebarItems[2]!.title}`)).toThrow();

    // Switch to the second tab
    rerender({
      activeTab: tabs[1],
    });

    // All titles are in the screen again
    expect(screen.getByText(sidebarItems[0]!.title)).toBeDefined();
    expect(screen.getByText(sidebarItems[1]!.title)).toBeDefined();
    expect(screen.getByText(sidebarItems[2]!.title)).toBeDefined();

    // Only the second component is rendered
    expect(() => screen.getByText(`Component of ${sidebarItems[0]!.title}`)).toThrow();
    expect(screen.getByText(`Component of ${sidebarItems[1]!.title}`)).toBeDefined();
    expect(() => screen.getByText(`Component of ${sidebarItems[2]!.title}`)).toThrow();

    // Switch to the third tab
    rerender({
      activeTab: tabs[2],
    });

    // All titles are in the screen again
    expect(screen.getByText(sidebarItems[0]!.title)).toBeDefined();
    expect(screen.getByText(sidebarItems[1]!.title)).toBeDefined();
    expect(screen.getByText(sidebarItems[2]!.title)).toBeDefined();

    // Only the third component is rendered
    expect(() => screen.getByText(`Component of ${sidebarItems[0]!.title}`)).toThrow();
    expect(() => screen.getByText(`Component of ${sidebarItems[1]!.title}`)).toThrow();
    expect(screen.getByText(`Component of ${sidebarItems[2]!.title}`)).toBeDefined();
  });

  it("should not render any component when activetab is undefined", () => {
    const { sidebarItems } = renderComponent({ activeTab: undefined });

    // All titles are in the screen
    expect(screen.getByText(sidebarItems[0]!.title)).toBeDefined();
    expect(screen.getByText(sidebarItems[1]!.title)).toBeDefined();
    expect(screen.getByText(sidebarItems[2]!.title)).toBeDefined();

    // Will not find any component content
    expect(() => screen.getByText(`Component of ${sidebarItems[0]!.title}`)).toThrow();
    expect(() => screen.getByText(`Component of ${sidebarItems[1]!.title}`)).toThrow();
    expect(() => screen.getByText(`Component of ${sidebarItems[2]!.title}`)).toThrow();
  });

  it("should render the badge content", () => {
    const { items } = buildSidebarItems();
    const key = "withBadge";
    items.set(
      key,
      buildSidebarItem({
        badge: {
          count: BasicBuilder.number(),
        },
      }),
    );
    const expectedItem = items.get(key)!;

    renderComponent({ items, activeTab: undefined });

    expect(screen.getByText(expectedItem.title)).toBeDefined();
    expect(screen.getByText(expectedItem.badge!.count)).toBeDefined();
  });

  it("should call setActiveTab when a tab is clicked", () => {
    const setActiveTab = jest.fn();

    const { tabs, props } = renderComponent({
      setActiveTab,
    });

    const { anchor } = props;
    const tabToClick = tabs[1];

    screen.getByTestId(`${tabToClick}-${anchor}`).click();
    expect(setActiveTab).toHaveBeenCalledWith(tabToClick);
  });

  it("should not call setActiveTab when the same tab is clicked", () => {
    const setActiveTab = jest.fn();

    const { props } = renderComponent({
      setActiveTab,
    });

    const { activeTab, anchor } = props;

    screen.getByTestId(`${activeTab}-${anchor}`).click();
    expect(setActiveTab).not.toHaveBeenCalled();
  });

  it("should call onClose when the close button is clicked", () => {
    const onClose = jest.fn();

    const { props } = renderComponent({
      onClose,
    });

    const { anchor } = props;

    screen.getByTestId(`sidebar-close-${anchor}`).click();
    expect(onClose).toHaveBeenCalled();
  });

  it("should change tabs when setActiveTab is called", () => {
    let newActiveTab = "";

    const setActiveTab = jest.fn((tab: string) => {
      newActiveTab = tab;
    });

    const { tabs, sidebarItems, props, rerender } = renderComponent({
      setActiveTab,
    });

    // Only the first component is rendered
    expect(screen.getByText(`Component of ${sidebarItems[0]?.title}`)).toBeDefined();
    expect(() => screen.getByText(`Component of ${sidebarItems[1]?.title}`)).toThrow();

    const { anchor } = props;
    const tabToClick = tabs[1];

    // Click in the second tab
    screen.getByTestId(`${tabToClick}-${anchor}`).click();

    // Expect the setActiveTab to have been called and changed the activeTab
    expect(setActiveTab).toHaveBeenCalledWith(tabToClick);
    expect(newActiveTab).toBe(tabToClick);

    rerender({ activeTab: newActiveTab });

    // Only the second component is rendered
    expect(() => screen.getByText(`Component of ${sidebarItems[0]?.title}`)).toThrow();
    expect(screen.getByText(`Component of ${sidebarItems[1]?.title}`)).toBeDefined();
  });
});
