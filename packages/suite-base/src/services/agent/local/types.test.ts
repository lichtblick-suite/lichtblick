// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { LlmProviderError, isLlmContentBlock } from "./types";

describe("local agent types", () => {
  it("guards provider-neutral history blocks", () => {
    expect(isLlmContentBlock({ type: "text", text: "hello" })).toBe(true);
    expect(
      isLlmContentBlock({
        type: "tool-call",
        id: "1",
        name: "get_data_catalog",
        input: {},
      }),
    ).toBe(true);
    expect(
      isLlmContentBlock({
        type: "tool-result",
        toolCallId: "1",
        content: null,
      }),
    ).toBe(true);
    expect(isLlmContentBlock({ type: "tool-result", toolCallId: "1" })).toBe(
      false,
    );
  });

  it("carries normalized provider retry metadata", () => {
    const error = new LlmProviderError("limited", "anthropic", true, {
      status: 429,
    });

    expect(error).toMatchObject({
      name: "LlmProviderError",
      message: "limited",
      provider: "anthropic",
      retryable: true,
      status: 429,
    });
  });
});
