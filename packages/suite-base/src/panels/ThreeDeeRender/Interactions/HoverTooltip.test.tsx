/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import "@testing-library/jest-dom";

import { act, fireEvent, render, waitFor } from "@testing-library/react";

import ThemeProvider from "@lichtblick/suite-base/theme/ThemeProvider";

import { HoverTooltip } from "./HoverTooltip";
import type { HoverEntityInfo } from "./types";

function makeCanvas(bounds?: Partial<DOMRect>): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.getBoundingClientRect = jest.fn(
    () =>
      ({
        left: 0,
        top: 0,
        right: 300,
        bottom: 300,
        width: 300,
        height: 300,
        x: 0,
        y: 0,
        toJSON: () => "",
        ...bounds,
      }) as DOMRect,
  );
  return canvas;
}

function renderHoverTooltip(props: {
  entities: HoverEntityInfo[];
  position: { clientX: number; clientY: number };
  canvas: HTMLCanvasElement | ReactNull;
}) {
  return render(
    <ThemeProvider isDark={false}>
      <HoverTooltip {...props} />
    </ThemeProvider>,
  );
}

describe("<HoverTooltip />", () => {
  const originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth");
  const originalOffsetHeight = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "offsetHeight",
  );

  beforeEach(() => {
    jest.useFakeTimers();

    Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
      configurable: true,
      get() {
        return 200;
      },
    });
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get() {
        return 200;
      },
    });
  });

  afterEach(() => {
    jest.useRealTimers();

    if (originalOffsetWidth) {
      Object.defineProperty(HTMLElement.prototype, "offsetWidth", originalOffsetWidth);
    }
    if (originalOffsetHeight) {
      Object.defineProperty(HTMLElement.prototype, "offsetHeight", originalOffsetHeight);
    }
  });

  it("renders nothing when there are no entities", () => {
    const { container } = renderHoverTooltip({
      entities: [],
      position: { clientX: 10, clientY: 20 },
      canvas: makeCanvas(),
    });

    expect(container.querySelector(".MuiPaper-root")).toBeNull();
  });

  it("renders topic, entityId, and metadata rows", () => {
    const entities: HoverEntityInfo[] = [
      {
        topic: "/topic",
        entityId: "entity-1",
        metadata: [
          { key: "k1", value: "v1" },
          { key: "k2", value: "v2" },
        ],
      },
      {
        topic: "/topic",
        entityId: "entity-2",
        metadata: [{ key: "k3", value: "v3" }],
      },
    ];

    const { getAllByText, getByText } = renderHoverTooltip({
      entities,
      position: { clientX: 10, clientY: 20 },
      canvas: makeCanvas(),
    });

    // Topic is shown per entry on its own line.
    expect(getAllByText("/topic")).toHaveLength(2);

    expect(getByText("entity-1")).toBeInTheDocument();
    expect(getByText("k1")).toBeInTheDocument();
    expect(getByText("v1")).toBeInTheDocument();

    expect(getByText("entity-2")).toBeInTheDocument();
    expect(getByText("k3")).toBeInTheDocument();
    expect(getByText("v3")).toBeInTheDocument();
  });

  it("keeps tooltip visible briefly when entities clear, then hides after grace period", async () => {
    const entities: HoverEntityInfo[] = [
      {
        topic: "/sensors/lidar",
        entityId: "obstacle-1",
        metadata: [{ key: "distance", value: "12.5m" }],
      },
    ];

    const view = renderHoverTooltip({
      entities,
      position: { clientX: 100, clientY: 100 },
      canvas: makeCanvas(),
    });

    expect(view.container.querySelector(".MuiPaper-root")).not.toBeNull();

    view.rerender(
      <ThemeProvider isDark={false}>
        <HoverTooltip
          entities={[]}
          position={{ clientX: 100, clientY: 100 }}
          canvas={makeCanvas()}
        />
      </ThemeProvider>,
    );

    // Still visible during grace.
    expect(view.container.querySelector(".MuiPaper-root")).not.toBeNull();

    act(() => {
      jest.advanceTimersByTime(349);
    });
    expect(view.container.querySelector(".MuiPaper-root")).not.toBeNull();

    act(() => {
      jest.advanceTimersByTime(1);
    });

    await waitFor(() => {
      expect(view.container.querySelector(".MuiPaper-root")).toBeNull();
    });
  });

  it("pins on hover during grace and hides after leave delay", async () => {
    const canvas = makeCanvas();
    const entities: HoverEntityInfo[] = [
      {
        topic: "/sensors/lidar",
        entityId: "obstacle-1",
        metadata: [{ key: "distance", value: "12.5m" }],
      },
    ];

    const view = renderHoverTooltip({
      entities,
      position: { clientX: 100, clientY: 100 },
      canvas,
    });

    // Enter grace.
    view.rerender(
      <ThemeProvider isDark={false}>
        <HoverTooltip entities={[]} position={{ clientX: 100, clientY: 100 }} canvas={canvas} />
      </ThemeProvider>,
    );

    const paper = view.container.querySelector(".MuiPaper-root")!;
    expect(paper).toBeTruthy();

    fireEvent.mouseEnter(paper);

    // Grace timer should no longer hide it.
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(view.container.querySelector(".MuiPaper-root")).not.toBeNull();

    fireEvent.mouseLeave(paper);

    act(() => {
      jest.advanceTimersByTime(299);
    });
    expect(view.container.querySelector(".MuiPaper-root")).not.toBeNull();

    act(() => {
      jest.advanceTimersByTime(1);
    });

    await waitFor(() => {
      expect(view.container.querySelector(".MuiPaper-root")).toBeNull();
    });
  });

  it("freezes content when click-pinned", async () => {
    const canvas = makeCanvas();

    const entitiesA: HoverEntityInfo[] = [
      {
        topic: "/sensors/lidar",
        entityId: "obstacle-front",
        metadata: [{ key: "distance", value: "5.2m" }],
      },
    ];
    const entitiesB: HoverEntityInfo[] = [
      {
        topic: "/sensors/camera",
        entityId: "pedestrian-1",
        metadata: [{ key: "confidence", value: "0.95" }],
      },
    ];

    const view = renderHoverTooltip({
      entities: entitiesA,
      position: { clientX: 100, clientY: 100 },
      canvas,
    });

    // Enter grace (interactive) so click is realistic.
    view.rerender(
      <ThemeProvider isDark={false}>
        <HoverTooltip entities={[]} position={{ clientX: 100, clientY: 100 }} canvas={canvas} />
      </ThemeProvider>,
    );

    const paper = view.container.querySelector(".MuiPaper-root")!;
    fireEvent.click(paper);

    // Providing new entities while click-pinned must NOT update the displayed content.
    view.rerender(
      <ThemeProvider isDark={false}>
        <HoverTooltip
          entities={entitiesB}
          position={{ clientX: 999, clientY: 999 }}
          canvas={canvas}
        />
      </ThemeProvider>,
    );

    // Still shows original data; new entity must not appear.
    await waitFor(() => {
      expect(view.getByText("obstacle-front")).toBeInTheDocument();
      expect(view.queryByText("pedestrian-1")).toBeNull();
    });
  });

  it("ignores mouse leave when click-pinned", async () => {
    const canvas = makeCanvas();
    const entities: HoverEntityInfo[] = [
      {
        topic: "/sensors/lidar",
        entityId: "obstacle-front",
        metadata: [{ key: "distance", value: "5.2m" }],
      },
    ];

    const view = renderHoverTooltip({
      entities,
      position: { clientX: 100, clientY: 100 },
      canvas,
    });

    // Enter grace then click-pin.
    view.rerender(
      <ThemeProvider isDark={false}>
        <HoverTooltip entities={[]} position={{ clientX: 100, clientY: 100 }} canvas={canvas} />
      </ThemeProvider>,
    );
    const paper = view.container.querySelector(".MuiPaper-root")!;
    fireEvent.click(paper);

    // Leaving should not hide when click-pinned.
    fireEvent.mouseLeave(paper);
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(view.container.querySelector(".MuiPaper-root")).not.toBeNull();
  });

  it("dismisses click-pinned tooltip on outside click", async () => {
    const canvas = makeCanvas();
    const entities: HoverEntityInfo[] = [
      {
        topic: "/sensors/lidar",
        entityId: "obstacle-front",
        metadata: [{ key: "distance", value: "5.2m" }],
      },
    ];

    const view = renderHoverTooltip({
      entities,
      position: { clientX: 100, clientY: 100 },
      canvas,
    });

    // Enter grace then click-pin.
    view.rerender(
      <ThemeProvider isDark={false}>
        <HoverTooltip entities={[]} position={{ clientX: 100, clientY: 100 }} canvas={canvas} />
      </ThemeProvider>,
    );
    const paper = view.container.querySelector(".MuiPaper-root")!;
    fireEvent.click(paper);
    expect(view.container.querySelector(".MuiPaper-root")).not.toBeNull();

    // Outside click dismisses.
    fireEvent.mouseDown(document.body);
    await waitFor(() => {
      expect(view.container.querySelector(".MuiPaper-root")).toBeNull();
    });
  });

  it("dismisses click-pinned tooltip on Escape key", async () => {
    const canvas = makeCanvas();
    const entities: HoverEntityInfo[] = [
      {
        topic: "/sensors/lidar",
        entityId: "obstacle-front",
        metadata: [{ key: "distance", value: "5.2m" }],
      },
    ];

    const view = renderHoverTooltip({
      entities,
      position: { clientX: 100, clientY: 100 },
      canvas,
    });

    // Enter grace then click-pin.
    view.rerender(
      <ThemeProvider isDark={false}>
        <HoverTooltip entities={[]} position={{ clientX: 100, clientY: 100 }} canvas={canvas} />
      </ThemeProvider>,
    );
    const paper = view.container.querySelector(".MuiPaper-root")!;
    fireEvent.click(paper);
    expect(view.container.querySelector(".MuiPaper-root")).not.toBeNull();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(view.container.querySelector(".MuiPaper-root")).toBeNull();
    });
  });

  it("enters settled mode after dwell and delays update to new item with grace period", async () => {
    const canvas = makeCanvas();
    const entitiesA: HoverEntityInfo[] = [
      {
        topic: "/sensors/lidar",
        entityId: "obstacle-front",
        metadata: [{ key: "distance", value: "5.2m" }],
      },
    ];
    const entitiesB: HoverEntityInfo[] = [
      {
        topic: "/sensors/camera",
        entityId: "pedestrian-1",
        metadata: [{ key: "confidence", value: "0.95" }],
      },
    ];

    const view = renderHoverTooltip({
      entities: entitiesA,
      position: { clientX: 100, clientY: 100 },
      canvas,
    });

    // Dwell 700 ms → settled mode.
    act(() => {
      jest.advanceTimersByTime(700);
    });

    // Now switch to pedestrian-1 while settled – grace period (350 ms) should delay the update.
    view.rerender(
      <ThemeProvider isDark={false}>
        <HoverTooltip
          entities={entitiesB}
          position={{ clientX: 110, clientY: 110 }}
          canvas={canvas}
        />
      </ThemeProvider>,
    );

    // During grace, still showing obstacle-front.
    expect(view.getByText("obstacle-front")).toBeInTheDocument();
    expect(view.queryByText("pedestrian-1")).toBeNull();

    // 349 ms in – still in grace.
    act(() => {
      jest.advanceTimersByTime(349);
    });
    expect(view.getByText("obstacle-front")).toBeInTheDocument();
    expect(view.queryByText("pedestrian-1")).toBeNull();

    // 1 ms more – grace ends, pedestrian-1 content appears.
    act(() => {
      jest.advanceTimersByTime(1);
    });

    await waitFor(() => {
      expect(view.getByText("pedestrian-1")).toBeInTheDocument();
      expect(view.queryByText("obstacle-front")).toBeNull();
    });
  });

  it("hover-pinned mode freezes content and ignores entity changes", async () => {
    const canvas = makeCanvas();
    const entitiesA: HoverEntityInfo[] = [
      {
        topic: "/sensors/lidar",
        entityId: "obstacle-front",
        metadata: [{ key: "distance", value: "5.2m" }],
      },
    ];
    const entitiesB: HoverEntityInfo[] = [
      {
        topic: "/sensors/camera",
        entityId: "pedestrian-1",
        metadata: [{ key: "confidence", value: "0.95" }],
      },
    ];

    const view = renderHoverTooltip({
      entities: entitiesA,
      position: { clientX: 100, clientY: 100 },
      canvas,
    });

    // Enter grace then hover-pin.
    view.rerender(
      <ThemeProvider isDark={false}>
        <HoverTooltip entities={[]} position={{ clientX: 100, clientY: 100 }} canvas={canvas} />
      </ThemeProvider>,
    );
    const paper = view.container.querySelector(".MuiPaper-root")!;
    fireEvent.mouseEnter(paper);

    // Provide different entities while hover-pinned – content must stay frozen.
    view.rerender(
      <ThemeProvider isDark={false}>
        <HoverTooltip
          entities={entitiesB}
          position={{ clientX: 999, clientY: 999 }}
          canvas={canvas}
        />
      </ThemeProvider>,
    );

    expect(view.getByText("obstacle-front")).toBeInTheDocument();
    expect(view.queryByText("pedestrian-1")).toBeNull();
  });

  it("omits topic line when topic is undefined", () => {
    const entities: HoverEntityInfo[] = [
      {
        topic: undefined,
        entityId: "frame::child",
        metadata: [
          { key: "child_frame_id", value: "base_link" },
          { key: "parent_frame_id", value: "map" },
        ],
      },
    ];

    const { getByText, queryByText } = renderHoverTooltip({
      entities,
      position: { clientX: 10, clientY: 20 },
      canvas: makeCanvas(),
    });

    expect(getByText("frame::child")).toBeInTheDocument();
    expect(getByText("base_link")).toBeInTheDocument();
    // No topic line should appear.
    expect(queryByText("unknown")).toBeNull();
  });

  it("shows 'Click to pin' hint in hover-pinned mode and hides it in click-pinned mode", async () => {
    const canvas = makeCanvas();
    const entities: HoverEntityInfo[] = [
      {
        topic: "/sensors/lidar",
        entityId: "obstacle-1",
        metadata: [{ key: "distance", value: "12.5m" }],
      },
    ];

    const view = renderHoverTooltip({
      entities,
      position: { clientX: 100, clientY: 100 },
      canvas,
    });

    // Enter grace so tooltip is interactive.
    view.rerender(
      <ThemeProvider isDark={false}>
        <HoverTooltip entities={[]} position={{ clientX: 100, clientY: 100 }} canvas={canvas} />
      </ThemeProvider>,
    );

    const paper = view.container.querySelector(".MuiPaper-root")!;
    fireEvent.mouseEnter(paper);

    // In hover-pinned mode, hint should be visible.
    expect(view.getByText("Click to pin")).toBeInTheDocument();

    // Click to pin — hint should disappear.
    fireEvent.click(paper);

    await waitFor(() => {
      expect(view.queryByText("Click to pin")).toBeNull();
    });
  });

  it("positions the tooltip inside canvas bounds by flipping left/up when near the edge", async () => {
    // offsetWidth/offsetHeight are mocked to 200 in beforeEach.
    const canvas = makeCanvas({
      left: 0,
      top: 0,
      right: 300,
      bottom: 300,
      width: 300,
      height: 300,
    });
    const entities: HoverEntityInfo[] = [
      {
        topic: "/sensors/lidar",
        entityId: "obstacle-1",
        metadata: [{ key: "distance", value: "12.5m" }],
      },
    ];

    const view = renderHoverTooltip({
      entities,
      position: { clientX: 290, clientY: 290 },
      canvas,
    });

    // Trigger a second render so paperRef.current is populated and the
    // measured element size (200×200) is used instead of the max constants.
    view.rerender(
      <ThemeProvider isDark={false}>
        <HoverTooltip
          entities={entities}
          position={{ clientX: 290, clientY: 290 }}
          canvas={canvas}
        />
      </ThemeProvider>,
    );

    const paper = await waitFor(() => view.container.querySelector<HTMLElement>(".MuiPaper-root")!);

    // Measured tooltip size is 200×200, offset is 6.
    // At (290, 290) in 300×300 bounds there isn't space right/below so it flips:
    // left = 290 - 200 - 6 = 84, top = 290 - 200 - 6 = 84
    expect(paper.style.left).toBe("84px");
    expect(paper.style.top).toBe("84px");
  });
});
