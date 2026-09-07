/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

import TextContent from "@lichtblick/suite-base/components/TextContent";
import LinkHandlerContext from "@lichtblick/suite-base/context/LinkHandlerContext";
import { BasicBuilder } from "@lichtblick/test-builders";

type SetupProps = {
  children: React.ReactNode;
  style?: React.CSSProperties;
  allowMarkdownHtml?: boolean;
  handleLink?: (event: React.MouseEvent, href: string) => void;
};

function setup({ children, style, allowMarkdownHtml, handleLink }: SetupProps) {
  const handleLinkMock = handleLink ?? jest.fn();
  const utils = render(
    <LinkHandlerContext.Provider value={handleLinkMock}>
      <TextContent style={style} allowMarkdownHtml={allowMarkdownHtml}>
        {children}
      </TextContent>
    </LinkHandlerContext.Provider>,
  );
  return { ...utils, handleLink: handleLinkMock };
}

describe("TextContent", () => {
  const sampleText = BasicBuilder.string();
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe("rendering children", () => {
    it("should render non-string children directly", () => {
      // When
      setup({ children: <span data-testid="custom-child">{sampleText}</span> });
      // Then
      expect(screen.getByTestId("custom-child")).toHaveTextContent(sampleText);
    });

    it("should render string children as markdown", () => {
      // When
      setup({ children: `# ${sampleText}` });
      // Then
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(sampleText);
    });

    it("should render markdown links as anchors", () => {
      // When
      setup({ children: `[${sampleText}](https://example.com)` });
      // Then
      const link = screen.getByRole("link", { name: sampleText });
      expect(link).toHaveAttribute("href", "https://example.com");
    });

    it("should apply the provided style to the container", () => {
      // When
      const { container } = setup({ children: sampleText, style: { color: "red" } });
      // Then
      expect(container.firstChild).toHaveStyle({ color: "rgb(255, 0, 0)" });
    });
  });

  describe("allowMarkdownHtml", () => {
    it("should render raw HTML when allowMarkdownHtml is true", () => {
      // When
      setup({
        children: `<span data-testid="raw-html">${sampleText}</span>`,
        allowMarkdownHtml: true,
      });
      // Then
      expect(screen.getByTestId("raw-html")).toHaveTextContent(sampleText);
    });

    it("should not render raw HTML when allowMarkdownHtml is not set", () => {
      // When
      setup({ children: `<span data-testid="raw-html">${sampleText}</span>` });
      // Then
      expect(screen.queryByTestId("raw-html")).not.toBeInTheDocument();
    });
  });

  describe("link handling", () => {
    it("should call the link handler when a link is clicked", () => {
      // Given
      const { handleLink } = setup({ children: `[${sampleText}](https://example.com)` });
      // When
      fireEvent.click(screen.getByRole("link", { name: sampleText }));
      // Then
      expect(handleLink).toHaveBeenCalledWith(expect.anything(), "https://example.com");
    });
  });
});
