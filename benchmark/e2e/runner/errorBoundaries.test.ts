/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { ERROR_BOUNDARY_TITLES } from "./constants";
import { collectErrorBoundaryHits, formatErrorBoundaryFailure } from "./errorBoundaries";
import type { ErrorBoundaryHit } from "./types";

const PANEL_TITLE = "This panel encountered an unexpected error";
const APP_TITLE = "The app encountered an unexpected error";

/**
 * Markup shaped like the rendered `ErrorDisplay` (packages/suite-base/src/components/ErrorDisplay.tsx):
 * the theme remaps `Typography variant="h4"` to a `<div>`.
 */
class ErrorDisplayHtmlBuilder {
  #title = PANEL_TITLE;
  #titleTag = "div";
  #message: string | undefined = "Error creating WebGL context.";

  public withTitle(title: string): this {
    this.#title = title;
    return this;
  }

  public withTitleTag(tag: string): this {
    this.#titleTag = tag;
    return this;
  }

  public withoutMessage(): this {
    this.#message = undefined;
    return this;
  }

  public build(): string {
    const code = this.#message == undefined ? "" : `<code>${this.#message}</code>`;
    const tag = this.#titleTag;
    return `<div class="grid"><div class="stack"><div class="stack"><${tag}>${this.#title}</${tag}><div><p>Something went wrong in this panel.</p></div></div><hr/>${code}<a>Show details</a></div><div class="actions"></div></div>`;
  }
}

describe("collectErrorBoundaryHits", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("returns nothing for a page without error boundaries", () => {
    // Given
    document.body.innerHTML = `<div><div>3D</div><code>not an error</code></div>`;

    // When
    const hits = collectErrorBoundaryHits(ERROR_BOUNDARY_TITLES);

    // Then
    expect(hits).toEqual([]);
  });

  it("collects every panel and app error boundary with its message", () => {
    // Given: two crashed panels and an app-level boundary
    const panel = new ErrorDisplayHtmlBuilder().build();
    const app = new ErrorDisplayHtmlBuilder().withTitle(APP_TITLE).build();
    document.body.innerHTML = `<main><section>${panel}</section><section>${panel}</section>${app}</main>`;

    // When
    const hits = collectErrorBoundaryHits(ERROR_BOUNDARY_TITLES);

    // Then
    expect(hits).toEqual([
      { title: PANEL_TITLE, message: "Error creating WebGL context." },
      { title: PANEL_TITLE, message: "Error creating WebGL context." },
      { title: APP_TITLE, message: "Error creating WebGL context." },
    ]);
  });

  it("matches the title by text, whatever element renders it", () => {
    // Given: the same boundary with an <h4> title (theme without variant remapping)
    document.body.innerHTML = new ErrorDisplayHtmlBuilder().withTitleTag("h4").build();

    // When
    const hits = collectErrorBoundaryHits(ERROR_BOUNDARY_TITLES);

    // Then
    expect(hits).toEqual([{ title: PANEL_TITLE, message: "Error creating WebGL context." }]);
  });

  it("ignores text that merely contains a title", () => {
    // Given
    document.body.innerHTML = `<div>Docs: ${PANEL_TITLE} means a panel crashed</div>`;

    // When
    const hits = collectErrorBoundaryHits(ERROR_BOUNDARY_TITLES);

    // Then
    expect(hits).toEqual([]);
  });

  it("reports an empty message when the boundary shows none, without borrowing a neighbor's", () => {
    // Given: a boundary without message next to unrelated code elsewhere on the page
    const panel = new ErrorDisplayHtmlBuilder().withoutMessage().build();
    document.body.innerHTML = `<main><section><div>${panel}</div></section><section><code>other</code></section></main>`;

    // When
    const hits = collectErrorBoundaryHits(ERROR_BOUNDARY_TITLES);

    // Then
    expect(hits).toEqual([{ title: PANEL_TITLE, message: "" }]);
  });
});

describe("formatErrorBoundaryFailure", () => {
  it("returns undefined without hits", () => {
    // Given / When / Then
    expect(formatErrorBoundaryFailure({ label: "electron/pointcloud", hits: [] })).toBeUndefined();
  });

  it("groups identical boundaries with a count and keeps the error texts", () => {
    // Given
    const webgl: ErrorBoundaryHit = {
      title: PANEL_TITLE,
      message: "Error creating WebGL context.",
    };
    const hits = [webgl, webgl, { title: APP_TITLE, message: "" }];

    // When
    const message = formatErrorBoundaryFailure({ label: "electron/pointcloud", hits });

    // Then
    expect(message).toBe(
      [
        "electron/pointcloud: 3 error boundaries rendered, the run measured an error screen instead of the scenario:",
        `  - 2× ${PANEL_TITLE}: Error creating WebGL context.`,
        `  - 1× ${APP_TITLE}`,
      ].join("\n"),
    );
  });

  it("uses the singular for a single boundary", () => {
    // Given
    const hits = [{ title: PANEL_TITLE, message: "boom" }];

    // When
    const message = formatErrorBoundaryFailure({ label: "web/sinewave", hits });

    // Then
    expect(message).toMatch(/^web\/sinewave: 1 error boundary rendered/);
  });
});
