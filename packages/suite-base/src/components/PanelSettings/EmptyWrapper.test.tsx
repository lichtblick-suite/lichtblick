/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { render, screen } from "@testing-library/react";

import "@testing-library/jest-dom";

import { EmptyWrapper, EmptyWrapperProps } from "./EmptyWrapper";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("EmptyWrapper", () => {
  const childrenContent = "<div>Test Content</div>";

  const renderComponent = (propsOverride: Partial<EmptyWrapperProps> = {}) => {
    const props: EmptyWrapperProps = {
      children: childrenContent,
      enableNewTopNav: false,
      ...propsOverride,
    };

    return render(<EmptyWrapper {...props} />);
  };

  it("should render children inside EmptyState when enableNewTopNav is true", () => {
    renderComponent({ enableNewTopNav: true });

    expect(screen.getByText(childrenContent)).toBeInTheDocument();
    expect(screen.queryByText("panelSettings")).not.toBeInTheDocument();
  });

  it("should render children inside SidebarContent when enableNewTopNav is false", () => {
    renderComponent({ enableNewTopNav: false });

    expect(screen.getByText(childrenContent)).toBeInTheDocument();
    expect(screen.getByText("panelSettings")).toBeInTheDocument();
  });
});
