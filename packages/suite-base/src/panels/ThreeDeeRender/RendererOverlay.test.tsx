/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import "@testing-library/jest-dom";

import { act, render, waitFor } from "@testing-library/react";

import ThemeProvider from "@lichtblick/suite-base/theme/ThemeProvider";

import { RendererOverlay } from "./RendererOverlay";

let mockLastHoverTooltipProps: any = undefined;
let mockLastInteractionsProps: any = undefined;

jest.mock("./Interactions/HoverTooltip", () => {
  return {
    __esModule: true,
    HoverTooltip: (props: any) => {
      mockLastHoverTooltipProps = props;
      return undefined;
    },
  };
});

jest.mock("./Interactions", () => {
  return {
    __esModule: true,
    InteractionContextMenu: () => undefined,
    Interactions: (props: any) => {
      mockLastInteractionsProps = props;
      return undefined;
    },
  };
});

jest.mock("@lichtblick/suite-base/hooks/usePanelMousePresence", () => {
  return {
    __esModule: true,
    usePanelMousePresence: () => true,
  };
});

jest.mock("react-use", () => {
  return {
    __esModule: true,
    useLongPress: () => ({}),
  };
});

jest.mock("@lichtblick/suite-base/panels/ThreeDeeRender/HUD", () => {
  return {
    __esModule: true,
    HUD: () => undefined,
  };
});

jest.mock("./Stats", () => {
  return {
    __esModule: true,
    Stats: () => undefined,
  };
});

const mockRendererEventCallbacks = new Map<string, (...args: any[]) => void>();
const mockRenderer = {
  setPickingEnabled: jest.fn(),
  setSelectedRenderable: jest.fn(),
  canResetView: jest.fn(() => false),
  getContextMenuItems: jest.fn(() => []),
  fixedFrameId: undefined,
};

jest.mock("./RendererContext", () => {
  return {
    __esModule: true,
    useRenderer: () => mockRenderer,
    useRendererEvent: (eventName: string, cb: (...args: any[]) => void) => {
      mockRendererEventCallbacks.set(eventName, cb);
    },
  };
});

describe("<RendererOverlay /> hover wiring", () => {
  beforeEach(() => {
    mockRendererEventCallbacks.clear();
    mockLastHoverTooltipProps = undefined;
    mockLastInteractionsProps = undefined;
    jest.clearAllMocks();
  });

  function renderOverlay(canvas: HTMLCanvasElement | ReactNull) {
    return render(
      <ThemeProvider isDark={false}>
        <RendererOverlay
          addPanel={jest.fn() as any}
          canPublish={false}
          canvas={canvas}
          enableStats={false}
          interfaceMode="3d"
          measureActive={false}
          onChangePublishClickType={jest.fn()}
          onClickMeasure={jest.fn()}
          onClickPublish={jest.fn()}
          onShowTopicSettings={jest.fn()}
          onTogglePerspective={jest.fn()}
          perspective={false}
          publishActive={false}
          publishClickType="point"
          timezone={undefined}
        />
      </ThemeProvider>,
    );
  }

  it("maps hovered selections into HoverTooltip entities and absolute client position", async () => {
    const canvas = document.createElement("canvas");
    canvas.getBoundingClientRect = jest.fn(() => ({
      left: 100,
      top: 200,
      right: 500,
      bottom: 600,
      width: 400,
      height: 400,
      x: 100,
      y: 200,
      toJSON: () => "",
    }));

    renderOverlay(canvas);

    const cb = mockRendererEventCallbacks.get("renderableHovered");
    expect(cb).toBeDefined();
    const hoverMovedCb = mockRendererEventCallbacks.get("hoverMoved");
    expect(hoverMovedCb).toBeDefined();

    const details = {
      metadata: [
        { key: "m1", value: "mv1" },
        { key: 123, value: true },
      ],
      id: 42,
      frame_id: "map",
      enabled: false,
      nested: { a: 1 },
    };

    const renderable = {
      topic: "/my_topic",
      name: "my_entity on /my_topic",
      userData: { entityId: "my_entity" },
      details: jest.fn(() => details),
      instanceDetails: jest.fn(),
    };

    act(() => {
      hoverMovedCb?.({ x: 10, y: 20 } as any);
      cb?.(
        [
          {
            renderable,
            instanceIndex: undefined,
          },
        ] as any,
        { x: 10, y: 20 } as any,
      );
    });

    await waitFor(() => {
      expect(mockLastHoverTooltipProps).toBeDefined();
      expect(mockLastHoverTooltipProps.position).toEqual({ clientX: 110, clientY: 220 });
      expect(mockLastHoverTooltipProps.entities).toHaveLength(1);
    });

    const entity = mockLastHoverTooltipProps.entities[0];
    expect(entity.topic).toBe("/my_topic");
    expect(entity.entityId).toBe("my_entity");

    // metadata[] is included and coerced to strings
    expect(entity.metadata).toEqual(
      expect.arrayContaining([
        { key: "m1", value: "mv1" },
        { key: "123", value: "true" },
      ]),
    );

    // primitive top-level fields are included
    expect(entity.metadata).toEqual(
      expect.arrayContaining([
        { key: "id", value: "42" },
        { key: "frame_id", value: "map" },
        { key: "enabled", value: "false" },
      ]),
    );

    // nested objects are excluded
    expect(entity.metadata).not.toEqual(
      expect.arrayContaining([{ key: "nested", value: "[object Object]" }]),
    );
  });

  it("uses instanceDetails when instanceIndex is provided", async () => {
    const canvas = document.createElement("canvas");
    canvas.getBoundingClientRect = jest.fn(() => ({
      left: 0,
      top: 0,
      right: 100,
      bottom: 100,
      width: 100,
      height: 100,
      x: 0,
      y: 0,
      toJSON: () => "",
    }));

    renderOverlay(canvas);

    const cb = mockRendererEventCallbacks.get("renderableHovered");
    expect(cb).toBeDefined();

    const renderable = {
      topic: "/t",
      name: "n",
      userData: { entityId: "n" },
      details: jest.fn(() => ({ metadata: [{ key: "wrong", value: "wrong" }] })),
      instanceDetails: jest.fn(() => ({ metadata: [{ key: "ok", value: "yes" }], id: 9 })),
    };

    act(() => {
      cb?.(
        [
          {
            renderable,
            instanceIndex: 3,
          },
        ] as any,
        { x: 1, y: 2 } as any,
      );
    });

    await waitFor(() => {
      expect(mockLastHoverTooltipProps.entities).toHaveLength(1);
    });

    expect(renderable.instanceDetails).toHaveBeenCalledWith(3);
    expect(renderable.details).not.toHaveBeenCalled();

    const entity = mockLastHoverTooltipProps.entities[0];
    expect(entity.metadata).toEqual(expect.arrayContaining([{ key: "ok", value: "yes" }]));
    expect(entity.metadata).toEqual(expect.arrayContaining([{ key: "id", value: "9" }]));
  });

  it("clears hovered entities when selections are empty", async () => {
    const canvas = document.createElement("canvas");
    canvas.getBoundingClientRect = jest.fn(() => ({
      left: 0,
      top: 0,
      right: 100,
      bottom: 100,
      width: 100,
      height: 100,
      x: 0,
      y: 0,
      toJSON: () => "",
    }));

    renderOverlay(canvas);

    const cb = mockRendererEventCallbacks.get("renderableHovered");
    expect(cb).toBeDefined();

    act(() => {
      cb?.([] as any, { x: 0, y: 0 } as any);
    });

    await waitFor(() => {
      expect(mockLastHoverTooltipProps.entities).toEqual([]);
    });
  });

  it("does not create tooltip entries for selections with no topic and no metadata", async () => {
    const canvas = document.createElement("canvas");
    canvas.getBoundingClientRect = jest.fn(() => ({
      left: 0,
      top: 0,
      right: 100,
      bottom: 100,
      width: 100,
      height: 100,
      x: 0,
      y: 0,
      toJSON: () => "",
    }));

    renderOverlay(canvas);

    const cb = mockRendererEventCallbacks.get("renderableHovered");
    expect(cb).toBeDefined();

    const renderable = {
      topic: undefined,
      name: "af949d5a-8243-4e53-8b39-dfb05aac50ba",
      userData: {},
      details: jest.fn(() => undefined),
      instanceDetails: jest.fn(() => undefined),
    };

    act(() => {
      cb?.(
        [
          {
            renderable,
            instanceIndex: undefined,
          },
        ] as any,
        { x: 10, y: 20 } as any,
      );
    });

    await waitFor(() => {
      expect(mockLastHoverTooltipProps).toBeDefined();
      expect(mockLastHoverTooltipProps.entities).toEqual([]);
    });
  });
});

function makeCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.getBoundingClientRect = jest.fn(
    () =>
      ({
        left: 0,
        top: 0,
        right: 100,
        bottom: 100,
        width: 100,
        height: 100,
        x: 0,
        y: 0,
        toJSON: () => "",
      }) as DOMRect,
  );
  return canvas;
}

function makeRenderable(
  overrides: Partial<{
    topic: string;
    details: () => unknown;
    instanceDetails: (idx: number) => unknown;
  }> = {},
) {
  return {
    topic: "/topic",
    name: "entity on /topic",
    pose: { position: { x: 0, y: 0, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } },
    userData: { entityId: "entity" },
    details: jest.fn(() => ({ msg: "initial" })),
    instanceDetails: jest.fn(() => undefined),
    ...overrides,
  };
}

function renderOverlayForSelection(canvas: HTMLCanvasElement | ReactNull) {
  return render(
    <ThemeProvider isDark={false}>
      <RendererOverlay
        addPanel={jest.fn() as any}
        canPublish={false}
        canvas={canvas}
        enableStats={false}
        interfaceMode="3d"
        measureActive={false}
        onChangePublishClickType={jest.fn()}
        onClickMeasure={jest.fn()}
        onClickPublish={jest.fn()}
        onShowTopicSettings={jest.fn()}
        onTogglePerspective={jest.fn()}
        perspective={false}
        publishActive={false}
        publishClickType="point"
        timezone={undefined}
      />
    </ThemeProvider>,
  );
}

describe("<RendererOverlay /> endFrame refresh", () => {
  beforeEach(() => {
    mockRendererEventCallbacks.clear();
    mockLastInteractionsProps = undefined;
    jest.clearAllMocks();
  });

  it("registers an endFrame event handler", () => {
    renderOverlayForSelection(makeCanvas());
    expect(mockRendererEventCallbacks.has("endFrame")).toBe(true);
  });

  it("re-evaluates selectedObject.details() on endFrame when a renderable is selected", async () => {
    renderOverlayForSelection(makeCanvas());

    const renderable = makeRenderable();

    act(() => {
      mockRendererEventCallbacks.get("renderablesClicked")?.(
        [{ renderable, instanceIndex: undefined }] as any,
        { x: 0, y: 0 } as any,
      );
    });

    await waitFor(() => {
      expect(mockLastInteractionsProps?.selectedObject).toBeDefined();
    });

    const callsAfterSelect = (renderable.details as jest.Mock).mock.calls.length;
    expect(callsAfterSelect).toBeGreaterThan(0);

    // Re-read the callback after the re-render so we get the closure that
    // captures the updated selectedRenderable state.
    const endFrameCb = mockRendererEventCallbacks.get("endFrame");

    act(() => {
      endFrameCb?.();
    });

    await waitFor(() => {
      expect(renderable.details.mock.calls.length).toBeGreaterThan(callsAfterSelect);
    });
  });

  it("does not increment the refresh counter on endFrame when nothing is selected", async () => {
    renderOverlayForSelection(makeCanvas());

    await waitFor(() => {
      expect(mockLastInteractionsProps).toBeDefined();
    });

    expect(mockLastInteractionsProps.selectedObject).toBeUndefined();

    const endFrameCb = mockRendererEventCallbacks.get("endFrame");

    act(() => {
      endFrameCb?.();
      endFrameCb?.();
      endFrameCb?.();
    });

    await waitFor(() => {
      expect(mockLastInteractionsProps.selectedObject).toBeUndefined();
    });
  });

  it("stops refreshing after the selected renderable is cleared", async () => {
    renderOverlayForSelection(makeCanvas());

    const renderable = makeRenderable();

    act(() => {
      mockRendererEventCallbacks.get("renderablesClicked")?.(
        [{ renderable, instanceIndex: undefined }] as any,
        { x: 0, y: 0 } as any,
      );
    });

    await waitFor(() => {
      expect(mockLastInteractionsProps?.selectedObject).toBeDefined();
    });

    // Clear the selection
    act(() => {
      mockRendererEventCallbacks.get("renderablesClicked")?.([] as any, { x: 0, y: 0 } as any);
    });

    await waitFor(() => {
      expect(mockLastInteractionsProps?.selectedObject).toBeUndefined();
    });

    const callsBeforeEndFrame = renderable.details.mock.calls.length;

    const endFrameCb = mockRendererEventCallbacks.get("endFrame");
    act(() => {
      endFrameCb?.();
      endFrameCb?.();
    });

    await waitFor(() => {
      expect(mockLastInteractionsProps.selectedObject).toBeUndefined();
    });

    expect(renderable.details.mock.calls.length).toBe(callsBeforeEndFrame);
  });
});

describe("<RendererOverlay /> selectedObject construction", () => {
  beforeEach(() => {
    mockRendererEventCallbacks.clear();
    mockLastInteractionsProps = undefined;
    jest.clearAllMocks();
  });

  it("builds selectedObject from renderable.details() when no instanceIndex", async () => {
    renderOverlayForSelection(makeCanvas());

    const detailsData = { stamp: { sec: 1, nsec: 0 }, frame_id: "base_link" };
    const renderable = makeRenderable({ details: jest.fn(() => detailsData) });

    act(() => {
      mockRendererEventCallbacks.get("renderablesClicked")?.(
        [{ renderable, instanceIndex: undefined }] as any,
        { x: 0, y: 0 } as any,
      );
    });

    await waitFor(() => {
      expect(mockLastInteractionsProps?.selectedObject).toBeDefined();
    });

    const { selectedObject } = mockLastInteractionsProps;
    expect(selectedObject.object.interactionData.topic).toBe("/topic");
    expect(selectedObject.object.interactionData.highlighted).toBe(true);
    expect(selectedObject.object.interactionData.originalMessage).toEqual(detailsData);
    expect(selectedObject.object.interactionData.instanceDetails).toBeUndefined();
    expect(selectedObject.instanceIndex).toBeUndefined();
  });

  it("builds selectedObject from renderable.instanceDetails() when instanceIndex is provided", async () => {
    renderOverlayForSelection(makeCanvas());

    const instanceDetailsData = { per_instance: "value" };
    const renderable = makeRenderable({
      instanceDetails: jest.fn(() => instanceDetailsData),
    });

    act(() => {
      mockRendererEventCallbacks.get("renderablesClicked")?.(
        [{ renderable, instanceIndex: 5 }] as any,
        { x: 0, y: 0 } as any,
      );
    });

    await waitFor(() => {
      expect(mockLastInteractionsProps?.selectedObject).toBeDefined();
    });

    const { selectedObject } = mockLastInteractionsProps;
    expect(renderable.instanceDetails).toHaveBeenCalledWith(5);
    expect(selectedObject.object.interactionData.instanceDetails).toEqual(instanceDetailsData);
    expect(selectedObject.instanceIndex).toBe(5);
  });

  it("sets selectedObject to undefined when multiple renderables are selected", async () => {
    renderOverlayForSelection(makeCanvas());

    const renderableA = makeRenderable();
    const renderableB = makeRenderable();

    act(() => {
      mockRendererEventCallbacks.get("renderablesClicked")?.(
        [
          { renderable: renderableA, instanceIndex: undefined },
          { renderable: renderableB, instanceIndex: undefined },
        ] as any,
        { x: 0, y: 0 } as any,
      );
    });

    await waitFor(() => {
      expect(mockLastInteractionsProps).toBeDefined();
    });

    expect(mockLastInteractionsProps.selectedObject).toBeUndefined();
  });

  it("sets selectedObject to undefined when selection is cleared", async () => {
    renderOverlayForSelection(makeCanvas());

    const renderable = makeRenderable();

    act(() => {
      mockRendererEventCallbacks.get("renderablesClicked")?.(
        [{ renderable, instanceIndex: undefined }] as any,
        { x: 0, y: 0 } as any,
      );
    });

    await waitFor(() => {
      expect(mockLastInteractionsProps?.selectedObject).toBeDefined();
    });

    act(() => {
      mockRendererEventCallbacks.get("renderablesClicked")?.([] as any, { x: 0, y: 0 } as any);
    });

    await waitFor(() => {
      expect(mockLastInteractionsProps.selectedObject).toBeUndefined();
    });
  });
});
