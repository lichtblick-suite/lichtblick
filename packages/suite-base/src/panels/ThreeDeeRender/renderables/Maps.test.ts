/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import * as THREE from "three";

import { HUDItemManager } from "../HUDItemManager";
import { IRenderer, RendererConfig } from "../IRenderer";
import { LayerErrors } from "../LayerErrors";
import { makePose, Pose } from "../transforms";
import { DEFAULT_MAP_SETTINGS, LayerSettingsMap, MAP_LAYER_ID, Maps } from "./Maps";

function setup(config: Partial<LayerSettingsMap> = {}) {
  const layers: RendererConfig["layers"] = {
    map: { ...DEFAULT_MAP_SETTINGS, instanceId: "map", ...config },
  };
  const apply = jest.fn((out: Pose) => {
    out.position = { x: 100, y: 200, z: 3 };
    return out;
  });
  const renderer = {
    config: { layers },
    topics: [{ name: "/gps", schemaName: "sensor_msgs/NavSatFix" }],
    coordinateFrameList: [],
    hud: new HUDItemManager(jest.fn()),
    settings: { setNodesForKey: jest.fn(), errors: new LayerErrors() },
    on: jest.fn(),
    off: jest.fn(),
    addCustomLayerAction: jest.fn(),
    queueAnimationFrame: jest.fn(),
    updateCustomLayersCount: jest.fn(),
    normalizeFrameId: (id: string) => id.replace(/^\//, ""),
    transformTree: { apply },
    updateConfig: (fn: (draft: { layers: RendererConfig["layers"] }) => void) => {
      fn({ layers });
    },
  };
  const maps = new Maps(renderer as unknown as IRenderer);
  return { maps, renderer, layers, apply };
}

const fix = (latitude = 59) => ({
  topic: "/gps",
  schemaName: "sensor_msgs/NavSatFix",
  receiveTime: { sec: 12, nsec: 0 },
  message: {
    latitude,
    longitude: 18,
    header: { frame_id: "/gps_link", stamp: { sec: 10, nsec: 0 } },
    status: { status: 0 },
  },
  sizeInBytes: 0,
});

function locationHandler(maps: Maps) {
  return maps.getSubscriptions()[0]!.subscription.handler;
}

describe("Maps", () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>(
      async (_url, options) =>
        await new Promise<Response>((_resolve, reject) => {
          options?.signal?.addEventListener("abort", () => {
            reject(new Error("aborted"));
          });
        }),
    );
  });

  it("registers Add map and subscribes to location data without enabling the topic layer", () => {
    const { maps, renderer } = setup();
    expect(renderer.addCustomLayerAction).toHaveBeenCalledWith(
      expect.objectContaining({ layerId: MAP_LAYER_ID }),
    );
    expect(maps.getSubscriptions()[0]!.subscription.shouldSubscribe?.("/gps")).toBe(true);
    expect(maps.getSubscriptions()[0]!.subscription.shouldSubscribe?.("/other")).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
    maps.dispose();
  });

  it("anchors the first fix at its timestamp in the fixed frame and does not follow subsequent vehicle poses", () => {
    const { maps, apply } = setup();
    locationHandler(maps)(fix());
    maps.startFrame(12_000_000_000n, "base_link", "map");
    const renderable = maps.renderables.get("map")!;
    expect(renderable.userData.frameId).toBe("map");
    expect(renderable.userData.settings.latitude).toBe(59);
    expect(renderable.userData.pose.position).toEqual({ x: 100, y: 200, z: 2.99 });
    expect(apply.mock.calls[0]).toEqual([
      expect.anything(),
      makePose(),
      "map",
      "map",
      "gps_link",
      10_000_000_000n,
      10_000_000_000n,
    ]);
    locationHandler(maps)(fix(60));
    maps.startFrame(13_000_000_000n, "base_link", "map");
    expect(renderable.userData.settings.latitude).toBe(59);
    expect(fetch).toHaveBeenCalledTimes(2);
    maps.dispose();
  });

  it("waits for valid fixes and transforms, then recovers", () => {
    const { maps, apply, renderer } = setup();
    const invalid = fix();
    invalid.message.status.status = -1;
    locationHandler(maps)(invalid);
    maps.startFrame(12n, "map", "map");
    expect(fetch).not.toHaveBeenCalled();
    locationHandler(maps)(fix());
    apply.mockReturnValueOnce(undefined as unknown as Pose);
    maps.startFrame(12n, "map", "map");
    expect(fetch).not.toHaveBeenCalled();
    expect(renderer.hud.getHUDItems()[0]?.getMessage()).toContain(
      "waiting for the location frame transform",
    );
    maps.startFrame(12n, "map", "map");
    expect(fetch).toHaveBeenCalledTimes(2);
    maps.dispose();
  });

  it("reanchors after a seek and aborts requests when deleted", () => {
    const { maps, layers } = setup();
    locationHandler(maps)(fix());
    maps.startFrame(12n, "map", "map");
    const signal = (fetch as jest.Mock).mock.calls[0][1].signal as AbortSignal;
    maps.removeAllRenderables();
    expect(signal.aborted).toBe(true);
    locationHandler(maps)(fix(60));
    maps.startFrame(15n, "map", "map");
    expect(maps.renderables.get("map")!.userData.settings.latitude).toBe(60);
    maps.handleSettingsAction({
      action: "perform-node-action",
      payload: { path: ["layers", "map"], id: "delete" },
    });
    expect(layers.map).toBeUndefined();
    expect(maps.renderables.size).toBe(0);
    maps.dispose();
  });

  it("does not reload tiles for opacity or position changes, and aborts when hidden", () => {
    const { maps } = setup({ originMode: "manual" });
    const signal = (fetch as jest.Mock).mock.calls[0][1].signal as AbortSignal;
    maps.handleSettingsAction({
      action: "update",
      payload: { path: ["layers", "map", "opacity"], input: "number", value: 0.4 },
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(signal.aborted).toBe(false);
    maps.handleSettingsAction({
      action: "update",
      payload: { path: ["layers", "map", "visible"], input: "boolean", value: false },
    });
    expect(signal.aborted).toBe(true);
    maps.dispose();
  });

  it("disposes tile textures, geometry, material and bitmap", async () => {
    const close = jest.fn();
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      value: jest.fn().mockResolvedValue({ close }),
    });
    (fetch as jest.Mock).mockResolvedValue({ ok: true, blob: async () => new Blob() });
    const { maps } = setup({ originMode: "manual", radius: 0 });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const renderable = maps.renderables.get("map")!;
    const mesh = renderable.children[0] as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
    const disposeGeometry = jest.spyOn(mesh.geometry, "dispose");
    const disposeMaterial = jest.spyOn(mesh.material, "dispose");
    const disposeTexture = jest.spyOn(mesh.material.map!, "dispose");
    maps.dispose();
    expect(close).toHaveBeenCalledTimes(1);
    expect(disposeGeometry).toHaveBeenCalledTimes(1);
    expect(disposeMaterial).toHaveBeenCalledTimes(1);
    expect(disposeTexture).toHaveBeenCalledTimes(1);
  });
});
