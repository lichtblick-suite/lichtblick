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
    // Accept both DOM and Node fetch inputs; these tests only use the abort signal.
    globalThis.fetch = jest.fn(
      async (_url: unknown, options?: Pick<RequestInit, "signal">) =>
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

  it("refreshes coverage and alignment for moving fixes without seeking", async () => {
    const { maps, apply } = setup();
    locationHandler(maps)(fix());
    maps.startFrame(12_000_000_000n, "base_link", "map");
    const renderable = maps.renderables.get("map")!;
    expect(renderable.userData.frameId).toBe("map");
    expect(renderable.userData.settings.latitude).toBe(59);
    expect(renderable.userData.pose.position).toEqual({
      x: 100,
      y: 200,
      z: 2.99,
    });
    expect(apply.mock.calls[0]).toEqual([
      expect.anything(),
      makePose(),
      "map",
      "map",
      "gps_link",
      10_000_000_000n,
      10_000_000_000n,
    ]);
    const signal = (fetch as jest.Mock).mock.calls[0][1].signal as AbortSignal;
    const initialUrl = (fetch as jest.Mock).mock.calls[0][0];
    locationHandler(maps)(fix(59.0000001));
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(signal.aborted).toBe(false);
    locationHandler(maps)(fix(60));
    maps.startFrame(13_000_000_000n, "base_link", "map");
    expect(renderable.userData.settings.latitude).toBe(59);
    expect(renderable.userData.pose.position.x).toBe(100);
    expect(renderable.userData.pose.position.y).toBeLessThan(200);
    expect(renderable.userData.pose.position.z).toBe(2.99);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(signal.aborted).toBe(true);
    expect((fetch as jest.Mock).mock.calls[2][0]).not.toBe(initialUrl);
    maps.dispose();
  });

  it("moves the map on every GPS fix in a static frame without reloading the same tiles", () => {
    const { maps, renderer } = setup();
    locationHandler(maps)(fix());
    maps.startFrame(12_000_000_000n, "base_link", "map");
    const renderable = maps.renderables.get("map")!;
    const initialPosition = { ...renderable.userData.pose.position };
    renderer.queueAnimationFrame.mockClear();
    locationHandler(maps)(fix(59.00001));
    expect(renderer.queueAnimationFrame).toHaveBeenCalled();
    maps.startFrame(13_000_000_000n, "base_link", "map");
    expect(renderable.userData.pose.position.x).toBe(initialPosition.x);
    expect(renderable.userData.pose.position.y).toBeCloseTo(initialPosition.y - 1.113195, 4);
    expect(fetch).toHaveBeenCalledTimes(2);
    const updatedPosition = { ...renderable.userData.pose.position };
    maps.startFrame(14_000_000_000n, "base_link", "map");
    expect(renderable.userData.pose.position).toEqual(updatedPosition);
    maps.dispose();
  });

  it("keeps the map stationary when the vehicle transform matches GPS movement", () => {
    const { maps, apply } = setup();
    locationHandler(maps)(fix());
    maps.startFrame(12_000_000_000n, "base_link", "map");
    const renderable = maps.renderables.get("map")!;
    const initialPosition = { ...renderable.userData.pose.position };
    locationHandler(maps)(fix(59.00001));
    apply.mockImplementationOnce((out: Pose) => {
      out.position = { x: 100, y: 201.113195, z: 3 };
      return out;
    });
    maps.startFrame(13_000_000_000n, "base_link", "map");
    expect(renderable.userData.pose.position.y).toBeCloseTo(initialPosition.y, 4);
    expect(fetch).toHaveBeenCalledTimes(2);
    maps.dispose();
  });

  it("applies the map rotation to GPS displacement", () => {
    const { maps } = setup({ rotation: [0, 0, 90] });
    locationHandler(maps)(fix());
    maps.startFrame(12_000_000_000n, "base_link", "map");
    locationHandler(maps)(fix(59.00001));
    maps.startFrame(13_000_000_000n, "base_link", "map");
    const position = maps.renderables.get("map")!.userData.pose.position;
    expect(position.x).toBeCloseTo(101.113195, 4);
    expect(position.y).toBeCloseTo(200, 4);
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
      payload: {
        path: ["layers", "map", "opacity"],
        input: "number",
        value: 0.4,
      },
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(signal.aborted).toBe(false);
    maps.handleSettingsAction({
      action: "update",
      payload: {
        path: ["layers", "map", "visible"],
        input: "boolean",
        value: false,
      },
    });
    expect(signal.aborted).toBe(true);
    maps.dispose();
  });

  it("keeps overlapping meshes visible and fetches only the new tile column", async () => {
    const close = jest.fn();
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      value: jest.fn().mockImplementation(async () => ({ close })),
    });
    (fetch as jest.Mock).mockResolvedValue({ ok: true, blob: async () => new Blob() });
    const { maps } = setup({ originMode: "manual", latitude: 59, longitude: 18 });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const renderable = maps.renderables.get("map")!;
    const original = [...renderable.children];
    expect(original).toHaveLength(9);
    expect(fetch).toHaveBeenCalledTimes(9);
    renderable.update(renderable.userData.settings, {
      latitude: 59,
      longitude: 18 + 360 / 2 ** 18,
    });
    expect(renderable.children).toHaveLength(6);
    expect(renderable.children.every((mesh) => original.includes(mesh))).toBe(true);
    expect(close).toHaveBeenCalledTimes(3);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(renderable.children).toHaveLength(9);
    expect(fetch).toHaveBeenCalledTimes(12);
    const urls = (fetch as jest.Mock).mock.calls.map(([url]) => url);
    expect(new Set(urls).size).toBe(12);
    maps.dispose();
    expect(close).toHaveBeenCalledTimes(12);
  });

  it("preserves wrapped tile placements at world zoom", async () => {
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      value: jest.fn().mockImplementation(async () => ({ close: jest.fn() })),
    });
    (fetch as jest.Mock).mockResolvedValue({ ok: true, blob: async () => new Blob() });
    const { maps } = setup({ originMode: "manual", latitude: 0, longitude: 0, zoom: 0 });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const meshes = maps.renderables.get("map")!.children;
    expect(meshes).toHaveLength(3);
    expect(meshes.map((mesh) => Math.sign(mesh.position.x))).toEqual([-1, 0, 1]);
    maps.dispose();
  });

  it("retains overlapping in-flight requests and limits concurrency across coverage changes", async () => {
    const { maps } = setup({ originMode: "manual", latitude: 59, longitude: 18 });
    const renderable = maps.renderables.get("map")!;
    const calls = (fetch as jest.Mock).mock.calls;
    const leavingSignal = calls[0][1].signal as AbortSignal;
    const retainedSignal = calls[1][1].signal as AbortSignal;
    renderable.update(renderable.userData.settings, {
      latitude: 59,
      longitude: 18 + 360 / 2 ** 18,
    });
    expect(leavingSignal.aborted).toBe(true);
    expect(retainedSignal.aborted).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(2);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(calls.filter(([, options]) => !(options.signal as AbortSignal).aborted)).toHaveLength(2);
    expect(calls.filter(([url]) => url === calls[1][0])).toHaveLength(1);
    maps.dispose();
    expect(calls.every(([, options]) => (options.signal as AbortSignal).aborted)).toBe(true);
  });

  it.each<Partial<LayerSettingsMap>>([
    { provider: "satellite" },
    { tileUrl: "https://example.com/{z}/{x}/{y}.png" },
    { scheme: "tms" },
    { zoom: 17 },
    { radius: 2 },
    { latitude: 59.00001 },
    { longitude: 18.00001 },
  ])("fully clears tiles when configuration changes: %j", async (change) => {
    const close = jest.fn();
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      value: jest.fn().mockResolvedValue({ close }),
    });
    (fetch as jest.Mock).mockResolvedValue({ ok: true, blob: async () => new Blob() });
    const { maps } = setup({ originMode: "manual", latitude: 59, longitude: 18 });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const renderable = maps.renderables.get("map")!;
    expect(renderable.children).toHaveLength(9);
    renderable.update({ ...renderable.userData.settings, ...change });
    expect(renderable.children).toHaveLength(0);
    expect(close).toHaveBeenCalledTimes(9);
    maps.dispose();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(renderable.children).toHaveLength(0);
  });

  it("disposes tile textures, geometry, material and bitmap", async () => {
    const close = jest.fn();
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true,
      value: jest.fn().mockResolvedValue({ close }),
    });
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      blob: async () => new Blob(),
    });
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
