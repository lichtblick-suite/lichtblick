/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";

import { DataSourceOptionProps } from "@lichtblick/suite-base/components/DataSourceDialog/types";
import BasicBuilder from "@lichtblick/suite-base/testing/builders/BasicBuilder";

import DataSourceOption from "./DataSourceOption";

describe("DataSourceOption", () => {
  const mockProps: DataSourceOptionProps = {
    icon: <span data-testid="icon">Icon</span>,
    onClick: jest.fn(),
    text: BasicBuilder.string(),
    secondaryText: BasicBuilder.string(),
    href: undefined,
    target: "_blank",
  };

  const renderDataSourceOption = (props: Partial<DataSourceOptionProps> = {}) => {
    return render(<DataSourceOption {...mockProps} {...props} />);
  };

  it("renders the button with text and secondary text", () => {
    renderDataSourceOption();
    expect(screen.getByText(mockProps.text)).toBeInTheDocument();
    expect(screen.getByText(mockProps.secondaryText)).toBeInTheDocument();
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it("calls onClick when the button is clicked", () => {
    renderDataSourceOption();
    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(mockProps.onClick).toHaveBeenCalled();
  });

  it("renders a link when href is provided", () => {
    const hrefProps = { href: BasicBuilder.string() };
    renderDataSourceOption(hrefProps);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", hrefProps.href);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toContainElement(screen.getByRole("button"));
  });

  it("does not render a link when href is not provided", () => {
    renderDataSourceOption();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("applies the correct class to the button", () => {
    renderDataSourceOption();
    const button = screen.getByRole("button");
    expect(button.className).toContain("-connectionButton");
  });
});
