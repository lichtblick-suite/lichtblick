/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { useTranslation } from "react-i18next";

import { ChatMessage } from "@lichtblick/suite-base/services/agent/types";

import { MessageList } from "./MessageList";

jest.mock("react-i18next", () => ({
  useTranslation: jest.fn(),
}));

function renderContent(content: string) {
  const message: ChatMessage = {
    id: "message-1",
    role: "assistant",
    content,
    createdAt: "2026-07-28T00:00:00.000Z",
  };
  return render(<MessageList messages={[message]} />);
}

/**
 * Unlike MessageList.test.tsx, this renders react-markdown for real. The agent's answers lean on
 * GFM — its own skill documents are table-heavy — and without the GFM plugin a table degrades into
 * literal pipe characters, which is invisible to a test that stubs the renderer out.
 */
describe("assistant markdown rendering", () => {
  beforeEach(() => {
    (useTranslation as jest.Mock).mockReturnValue({ t: (key: string) => key });
  });

  it("renders GFM tables as real tables", () => {
    renderContent(
      ["| Panel | Renders |", "| --- | --- |", "| Plot | numeric paths |"].join("\n"),
    );

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Panel" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "numeric paths" })).toBeInTheDocument();
  });

  it("renders the other GFM constructs the agent uses", () => {
    const { container } = renderContent(
      ["~~dropped~~", "", "- [x] sliced", "- [ ] opened"].join("\n"),
    );

    expect(container.querySelector("del")).toHaveTextContent("dropped");
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).not.toBeChecked();
  });

  it("renders headings, code, and blockquotes as structured elements", () => {
    const { container } = renderContent(
      [
        "## Findings",
        "",
        "Use `/imu/data.linear_acceleration.x`.",
        "",
        "> Sliced before opening.",
        "",
        "```json",
        '{ "enabled": true }',
        "```",
      ].join("\n"),
    );

    expect(screen.getByRole("heading", { level: 2, name: "Findings" })).toBeInTheDocument();
    expect(container.querySelector("code")).toHaveTextContent(
      "/imu/data.linear_acceleration.x",
    );
    expect(container.querySelector("blockquote")).toHaveTextContent("Sliced before opening.");
    expect(container.querySelector("pre code")).toHaveTextContent('{ "enabled": true }');
  });

  it("still refuses to render raw HTML from model output", () => {
    const { container } = renderContent('<img src="x" onerror="alert(1)"> plain');

    expect(container.querySelector("img")).toBeNull();
    expect(container.innerHTML).not.toContain("onerror");
  });
});
