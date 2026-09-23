// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { t } from "i18next";
import * as THREE from "three";

import { toNanoSec } from "@lichtblick/rostime";
import { MessageEvent, Time, SettingsTreeAction, SettingsTreeFields } from "@lichtblick/suite";

import { AnyRendererSubscription, IRenderer } from "../IRenderer";
import { BaseUserData, Renderable } from "../Renderable";
import { onlyLastByTopicMessage, SceneExtension } from "../SceneExtension";
import { SettingsTreeEntry } from "../SettingsManager";
import { normalizeTime } from "../normalizeMessages";
import { CustomLayerSettings } from "../settings";
import { topicIsConvertibleToSchema } from "../topicIsConvertibleToSchema";
import { makePose, xyzrpyToPose } from "../transforms";
import { mapOffset, mapTiles, mapTileUrl, MAX_MAP_LATITUDE, validateMapUrl } from "./mapTiles";

export type LayerSettingsMap = CustomLayerSettings & {
  frameId?: string;
  originMode: "gps" | "manual";
  locationTopic: string;
  provider: "osm" | "satellite" | "custom";
  tileUrl: string;
  scheme: "xyz" | "tms";
  attribution: string;
  latitude: number;
  longitude: number;
  zoom: number;
  radius: number;
  opacity: number;
  position: [number, number, number];
  rotation: [number, number, number];
};

export const MAP_LAYER_ID = "lichtblick.Map";
export const DEFAULT_MAP_SETTINGS: LayerSettingsMap = {
  layerId: MAP_LAYER_ID,
  instanceId: "",
  label: "Map",
  visible: true,
  frameLocked: true,
  originMode: "gps",
  locationTopic: "",
  provider: "osm",
  tileUrl: "",
  scheme: "xyz",
  attribution: "",
  latitude: 0,
  longitude: 0,
  zoom: 18,
  radius: 1,
  opacity: 1,
  position: [0, 0, -0.01],
  rotation: [0, 0, 0],
};
const PROVIDERS = {
  osm: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap contributors",
    href: "https://www.openstreetmap.org/copyright",
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "© Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, GIS User Community",
    href: "https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9",
  },
};
const LOCATION_SCHEMAS = new Set([
  "sensor_msgs/NavSatFix",
  "sensor_msgs/msg/NavSatFix",
  "ros.sensor_msgs.NavSatFix",
  "foxglove_msgs/LocationFix",
  "foxglove_msgs/msg/LocationFix",
  "foxglove.LocationFix",
  "foxglove::LocationFix",
]);
type LocationMessage = {
  latitude: number;
  longitude: number;
  frame_id?: string;
  timestamp?: Time;
  header?: { frame_id?: string; stamp?: Time };
  status?: { status: number };
};
type MapAnchor = {
  latitude: number;
  longitude: number;
  position: [number, number, number];
  frameId: string;
};
const ERROR_ID = "map-tiles";
type MapUserData = BaseUserData & { settings: LayerSettingsMap };

export class MapRenderable extends Renderable<MapUserData> {
  public override readonly pickable = false;
  #controller = new AbortController();
  #meshes: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[] = [];
  #key: string | undefined;

  public update(
    settings: LayerSettingsMap,
    center: { latitude: number; longitude: number } = settings,
  ): void {
    this.userData.settings = settings;
    this.userData.pose = xyzrpyToPose(settings.position, settings.rotation);
    this.visible = settings.visible;
    for (const mesh of this.#meshes) {
      mesh.material.opacity = settings.opacity;
    }
    const centerTile =
      Number.isFinite(center.latitude) &&
      Math.abs(center.latitude) <= MAX_MAP_LATITUDE &&
      Number.isFinite(center.longitude) &&
      Math.abs(center.longitude) <= 180 &&
      Number.isInteger(settings.zoom) &&
      settings.zoom >= 0 &&
      settings.zoom <= 19
        ? mapTiles(center.latitude, center.longitude, settings.zoom, 0)[0]
        : undefined;
    const key = JSON.stringify([
      settings.visible,
      settings.provider,
      settings.tileUrl,
      settings.scheme,
      settings.latitude,
      settings.longitude,
      settings.zoom,
      settings.radius,
      centerTile?.x,
      centerTile?.y,
    ]);
    if (key === this.#key) {
      return;
    }
    this.#key = key;
    this.#clearTiles();
    this.renderer.settings.errors.remove(this.userData.settingsPath, ERROR_ID);
    if (!settings.visible) {
      return;
    }
    const template =
      settings.provider === "custom" ? settings.tileUrl : PROVIDERS[settings.provider].url;
    if (!validateMapUrl(template)) {
      this.renderer.settings.errors.add(
        this.userData.settingsPath,
        ERROR_ID,
        "Enter an HTTP(S) tile URL containing {z}, {x}, and {y} (or {-y}). The server must allow cross-origin requests.",
      );
      return;
    }
    if (
      !Number.isFinite(settings.latitude) ||
      Math.abs(settings.latitude) > MAX_MAP_LATITUDE ||
      !Number.isFinite(settings.longitude) ||
      Math.abs(settings.longitude) > 180 ||
      !Number.isInteger(settings.zoom) ||
      settings.zoom < 0 ||
      settings.zoom > 19 ||
      !Number.isInteger(settings.radius) ||
      settings.radius < 0 ||
      settings.radius > 3
    ) {
      this.renderer.settings.errors.add(
        this.userData.settingsPath,
        ERROR_ID,
        "Use a valid latitude/longitude, zoom 0–19, and tile radius 0–3.",
      );
      return;
    }
    const signal = this.#controller.signal;
    const isAborted = (): boolean => signal.aborted;
    const pending = mapTiles(
      settings.latitude,
      settings.longitude,
      settings.zoom,
      settings.radius,
      center,
    );
    // Only two in-flight requests per layer; no speculative zoom levels or persistent tile cache.
    const load = async (): Promise<void> => {
      while (!isAborted()) {
        const tile = pending.shift();
        if (!tile) {
          return;
        }
        let bitmap: ImageBitmap | undefined;
        try {
          const response = await fetch(
            mapTileUrl(
              template,
              tile,
              settings.zoom,
              settings.provider === "custom" ? settings.scheme : "xyz",
            ),
            { signal },
          );
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          bitmap = await createImageBitmap(await response.blob(), {
            imageOrientation: "flipY",
          });
          if (isAborted()) {
            bitmap.close();
            return;
          }
          const texture = new THREE.Texture(bitmap);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.needsUpdate = true;
          const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: this.userData.settings.opacity,
            depthWrite: false,
            side: THREE.DoubleSide,
          });
          const mesh = new THREE.Mesh(new THREE.PlaneGeometry(tile.size, tile.size), material);
          mesh.position.set(tile.east, tile.north, 0);
          mesh.renderOrder = -1;
          this.#meshes.push(mesh);
          this.add(mesh);
          this.renderer.queueAnimationFrame();
        } catch (error) {
          bitmap?.close();
          if (!isAborted()) {
            this.renderer.settings.errors.add(
              this.userData.settingsPath,
              ERROR_ID,
              `Unable to load map tiles. Check the URL, network, and server CORS permissions. ${String(error)}`,
            );
          }
        }
      }
    };
    void load();
    void load();
  }

  #clearTiles(): void {
    this.#controller.abort();
    this.#controller = new AbortController();
    for (const mesh of this.#meshes) {
      (mesh.material.map?.image as ImageBitmap | undefined)?.close();
      mesh.material.map?.dispose();
      mesh.material.dispose();
      mesh.geometry.dispose();
      this.remove(mesh);
    }
    this.#meshes = [];
  }

  public override dispose(): void {
    this.#clearTiles();
    this.#controller.abort();
    super.dispose();
  }
}

export class Maps extends SceneExtension<MapRenderable> {
  public static extensionId = "lichtblick.Maps";
  #fixes = new Map<string, MessageEvent<LocationMessage>>();
  #anchors = new Map<string, MapAnchor>();
  public constructor(renderer: IRenderer) {
    super(Maps.extensionId, renderer);
    renderer.addCustomLayerAction({
      layerId: MAP_LAYER_ID,
      label: t("threeDee:addMap"),
      icon: "Map",
      handler: this.#addMap,
    });
    renderer.on("transformTreeUpdated", this.#refreshSettings);
    for (const [id, config] of Object.entries(renderer.config.layers)) {
      if (config?.layerId === MAP_LAYER_ID) {
        this.#updateMap(id, config);
      }
    }
  }

  public override getSubscriptions(): readonly AnyRendererSubscription[] {
    return [
      {
        type: "schema",
        schemaNames: LOCATION_SCHEMAS,
        subscription: {
          handler: this.#handleLocation,
          filterQueue: onlyLastByTopicMessage,
          shouldSubscribe: (topic) =>
            Object.values(this.renderer.config.layers).some((config) => {
              const settings: Partial<LayerSettingsMap> | undefined = config;
              return (
                settings?.layerId === MAP_LAYER_ID &&
                settings.visible !== false &&
                settings.originMode !== "manual" &&
                this.#locationTopic(settings) === topic
              );
            }),
        },
      },
    ];
  }

  #locationTopic(settings: Partial<LayerSettingsMap>): string | undefined {
    return (
      (settings.locationTopic === "" ? undefined : settings.locationTopic) ??
      this.renderer.topics?.find((topic) => topicIsConvertibleToSchema(topic, LOCATION_SCHEMAS))
        ?.name
    );
  }

  #handleLocation = (event: MessageEvent<LocationMessage>): void => {
    const { latitude, longitude, status } = event.message;
    if (
      !Number.isFinite(latitude) ||
      Math.abs(latitude) > MAX_MAP_LATITUDE ||
      !Number.isFinite(longitude) ||
      Math.abs(longitude) > 180 ||
      (status != undefined && status.status < 0)
    ) {
      return;
    }
    this.#fixes.set(event.topic, event);
    this.renderer.queueAnimationFrame();
  };

  public override removeAllRenderables(): void {
    this.#fixes.clear();
    this.#anchors.clear();
    for (const [id, config] of Object.entries(this.renderer.config.layers)) {
      if (config?.layerId === MAP_LAYER_ID) {
        this.#updateMap(id, config);
      }
    }
  }

  public override dispose(): void {
    this.renderer.off("transformTreeUpdated", this.#refreshSettings);
    this.hud.removeGroup(Maps.extensionId);
    super.dispose();
  }

  #refreshSettings = (): void => {
    this.updateSettingsTree();
  };

  public override settingsNodes(): SettingsTreeEntry[] {
    const entries: SettingsTreeEntry[] = [];
    for (const [id, config] of Object.entries(this.renderer.config.layers)) {
      if (config?.layerId !== MAP_LAYER_ID) {
        continue;
      }
      const settings = {
        ...DEFAULT_MAP_SETTINGS,
        ...config,
      } as LayerSettingsMap;
      const fields: SettingsTreeFields = {
        provider: {
          label: "Map provider",
          input: "select",
          value: settings.provider,
          options: [
            { label: "OpenStreetMap", value: "osm" },
            { label: "Satellite (Esri)", value: "satellite" },
            { label: "Custom tile service", value: "custom" },
          ],
        },
        ...(settings.provider === "custom"
          ? {
              tileUrl: {
                label: "Tile URL",
                input: "string" as const,
                value: settings.tileUrl,
                placeholder: "https://example.com/{z}/{x}/{y}.png",
                help: "Raster Web Mercator tiles. Supports {z}, {x}, {y}, {-y}, and {s}. The server must allow CORS.",
              },
              scheme: {
                label: "Tile scheme",
                input: "select" as const,
                value: settings.scheme,
                options: [
                  { label: "XYZ (north origin)", value: "xyz" },
                  { label: "TMS (south origin)", value: "tms" },
                ],
              },
              attribution: {
                label: "Attribution",
                input: "string" as const,
                value: settings.attribution,
              },
            }
          : {}),
        originMode: {
          label: "Map origin",
          input: "select",
          value: settings.originMode,
          options: [
            { label: "Location topic + transforms", value: "gps" },
            { label: "Manual coordinates", value: "manual" },
          ],
        },
        ...(settings.originMode === "gps"
          ? {
              locationTopic: {
                label: "Location topic",
                input: "select" as const,
                value: settings.locationTopic,
                options: [
                  { label: "Automatic (first location topic)", value: "" },
                  ...(this.renderer.topics ?? [])
                    .filter((topic) => topicIsConvertibleToSchema(topic, LOCATION_SCHEMAS))
                    .map((topic) => ({ label: topic.name, value: topic.name })),
                ],
                help: "Aligns the map with each location fix and its frame transform during playback. Tile coverage follows the latest location fix. Fixed-frame axes should be east/north/up; adjust rotation if needed.",
              },
            }
          : {}),
        frameId: {
          label: t("threeDee:frame"),
          input: "select",
          value: settings.frameId,
          options: [
            {
              label: settings.originMode === "gps" ? "<Location message frame>" : "<Display frame>",
              value: undefined,
            },
            ...this.renderer.coordinateFrameList,
          ],
        },
        ...(settings.originMode === "manual"
          ? {
              latitude: {
                label: "Origin latitude",
                input: "number",
                value: settings.latitude,
                min: -MAX_MAP_LATITUDE,
                max: MAX_MAP_LATITUDE,
                precision: 7,
                help: "Geographic origin at the selected frame's position. East is +X, north is +Y. Local flat-earth approximation.",
              },
              longitude: {
                label: "Origin longitude",
                input: "number",
                value: settings.longitude,
                min: -180,
                max: 180,
                precision: 7,
              },
            }
          : {}),
        zoom: {
          label: "Tile zoom",
          input: "number",
          value: settings.zoom,
          min: 0,
          max: 19,
          step: 1,
          precision: 0,
        },
        radius: {
          label: "Tile radius",
          input: "number",
          value: settings.radius,
          min: 0,
          max: 3,
          step: 1,
          precision: 0,
          help: "Tiles around the current location (or manual origin): 0 = 1 tile, 1 = 9 tiles, up to 3 = 49 tiles.",
        },
        opacity: {
          label: "Opacity",
          input: "number",
          value: settings.opacity,
          min: 0,
          max: 1,
          step: 0.1,
        },
        position: {
          label: t("threeDee:position"),
          input: "vec3",
          value: settings.position,
          labels: ["X", "Y", "Z"],
          precision: 3,
        },
        rotation: {
          label: t("threeDee:rotation"),
          input: "vec3",
          value: settings.rotation,
          labels: ["R", "P", "Y"],
          precision: 1,
        },
      };
      entries.push({
        path: ["layers", id],
        node: {
          label: settings.label,
          icon: "Map",
          visible: settings.visible,
          order: settings.order,
          fields,
          handler: this.handleSettingsAction,
          actions: [{ type: "action", id: "delete", label: t("threeDee:delete") }],
        },
      });
      if (!this.renderables.has(id)) {
        this.#updateMap(id, settings);
      }
    }
    return entries;
  }

  public override startFrame(time: bigint, renderFrameId: string, fixedFrameId: string): void {
    for (const [id, renderable] of this.renderables) {
      const config = this.renderer.config.layers[id] as Partial<LayerSettingsMap>;
      if (config.originMode !== "manual") {
        const event = this.#fixes.get(this.#locationTopic(config) ?? "");
        if (event) {
          const message = event.message;
          const sourceFrame = this.renderer.normalizeFrameId(
            config.frameId ?? message.header?.frame_id ?? message.frame_id ?? "",
          );
          const stamp = message.header?.stamp ?? message.timestamp;
          const messageTime =
            stamp == undefined ? toNanoSec(event.receiveTime) : toNanoSec(normalizeTime(stamp));
          const pose = makePose();
          if (
            sourceFrame &&
            this.renderer.transformTree.apply(
              pose,
              makePose(),
              fixedFrameId,
              fixedFrameId,
              sourceFrame,
              messageTime,
              messageTime,
            )
          ) {
            const previous = this.#anchors.get(id);
            const anchor =
              previous?.frameId === fixedFrameId
                ? previous
                : {
                    latitude: message.latitude,
                    longitude: message.longitude,
                    position: [0, 0, 0] as [number, number, number],
                    frameId: fixedFrameId,
                  };
            // Align the current geographic fix with its current frame position. This also
            // works when GPS changes but the dataset has only a static vehicle frame.
            const offset = mapOffset(anchor.latitude, anchor.longitude, message);
            const rotation = xyzrpyToPose(
              [0, 0, 0],
              config.rotation ?? DEFAULT_MAP_SETTINGS.rotation,
            ).orientation;
            const displacement = new THREE.Vector3(offset.east, offset.north, 0).applyQuaternion(
              new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w),
            );
            anchor.position = [
              pose.position.x - displacement.x,
              pose.position.y - displacement.y,
              pose.position.z - displacement.z,
            ];
            this.#anchors.set(id, anchor);
            this.renderer.settings.errors.remove(["layers", id], "map-origin");
            this.#updateMap(id, config);
          }
        }
      }
      renderable.userData.frameId =
        this.#anchors.get(id)?.frameId ?? renderable.userData.settings.frameId ?? renderFrameId;
    }
    super.startFrame(time, renderFrameId, fixedFrameId);
    for (const [id, renderable] of this.renderables) {
      const settings = renderable.userData.settings;
      const config = this.renderer.config.layers[id] as Partial<LayerSettingsMap>;
      const waiting =
        config.visible !== false && config.originMode !== "manual" && !this.#anchors.has(id);
      this.hud.displayIfTrue(waiting, {
        id: `map-origin-${id}`,
        group: Maps.extensionId,
        displayType: "notice",
        getMessage: () =>
          this.#fixes.has(this.#locationTopic(config) ?? "")
            ? "Map: waiting for the location frame transform"
            : "Map: waiting for a valid location fix",
      });
      const provider = settings.provider === "custom" ? undefined : PROVIDERS[settings.provider];
      const attribution = provider?.attribution ?? settings.attribution;
      this.hud.displayIfTrue(renderable.visible && attribution.length > 0, {
        id: `map-${id}`,
        group: Maps.extensionId,
        displayType: "attribution",
        getMessage: () => attribution,
        href: provider?.href,
      });
    }
  }

  public override handleSettingsAction = (action: SettingsTreeAction): void => {
    if (action.action === "reorder-node") {
      return;
    }
    const path = action.payload.path;
    const id = path[1];
    if (path[0] !== "layers" || id == undefined) {
      return;
    }
    if (action.action === "perform-node-action") {
      if (path.length === 2 && action.payload.id === "delete") {
        this.renderer.updateConfig((draft) => {
          delete draft.layers[id];
        });
        const renderable = this.renderables.get(id);
        if (renderable) {
          renderable.dispose();
          this.remove(renderable);
          this.renderables.delete(id);
        }
        this.#anchors.delete(id);
        this.hud.removeHUDItem(`map-origin-${id}`);
        this.hud.removeHUDItem(`map-${id}`);
        this.renderer.settings.errors.clearPath(path);
        this.updateSettingsTree();
        this.renderer.updateCustomLayersCount();
      }
    } else if (path.length === 3) {
      if (["originMode", "locationTopic", "frameId"].includes(path[2]!)) {
        this.#anchors.delete(id);
      }
      this.saveSetting(path, action.payload.value);
      this.#updateMap(id, this.renderer.config.layers[id] as Partial<LayerSettingsMap>);
    }
    this.renderer.queueAnimationFrame();
  };

  #addMap = (id: string): void => {
    const order =
      Math.max(0, ...Object.values(this.renderer.config.layers).map((layer) => layer?.order ?? 0)) +
      1;
    const config = { ...DEFAULT_MAP_SETTINGS, instanceId: id, order };
    this.renderer.updateConfig((draft) => {
      draft.layers[id] = config;
    });
    this.#updateMap(id, config);
    this.updateSettingsTree();
    this.renderer.queueAnimationFrame();
  };

  #updateMap(id: string, config: Partial<LayerSettingsMap>): void {
    const settings = { ...DEFAULT_MAP_SETTINGS, ...config };
    if (settings.originMode === "gps") {
      const anchor = this.#anchors.get(id);
      if (anchor) {
        settings.latitude = anchor.latitude;
        settings.longitude = anchor.longitude;
        settings.position = [
          anchor.position[0] + settings.position[0],
          anchor.position[1] + settings.position[1],
          anchor.position[2] + settings.position[2],
        ];
      } else {
        settings.visible = false;
      }
    }
    let renderable = this.renderables.get(id);
    if (!renderable) {
      renderable = new MapRenderable(id, this.renderer, {
        receiveTime: 0n,
        messageTime: 0n,
        frameId: "",
        pose: xyzrpyToPose(settings.position, settings.rotation),
        settingsPath: ["layers", id],
        settings,
      });
      this.renderables.set(id, renderable);
      this.add(renderable);
    }
    if (
      settings.provider !== renderable.userData.settings.provider ||
      settings.attribution !== renderable.userData.settings.attribution
    ) {
      this.hud.removeHUDItem(`map-${id}`);
    }
    const center =
      settings.originMode === "gps"
        ? this.#fixes.get(this.#locationTopic(settings) ?? "")?.message
        : undefined;
    renderable.update(settings, center);
  }
}
