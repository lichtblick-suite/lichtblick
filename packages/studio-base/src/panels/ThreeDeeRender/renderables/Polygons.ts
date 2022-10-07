// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { toNanoSec } from "@foxglove/rostime";
import { SettingsTreeAction, SettingsTreeFields } from "@foxglove/studio";
import type { RosValue } from "@foxglove/studio-base/players/types";

import { BaseUserData, Renderable } from "../Renderable";
import { Renderer } from "../Renderer";
import { PartialMessage, PartialMessageEvent, SceneExtension } from "../SceneExtension";
import { SettingsTreeEntry } from "../SettingsManager";
import { makeRgba, rgbaToCssString, stringToRgba } from "../color";
import { normalizeHeader, normalizeVector3s } from "../normalizeMessages";
import {
  Marker,
  MarkerAction,
  MarkerType,
  Polygon,
  PolygonStamped,
  POLYGON_STAMPED_DATATYPES,
  TIME_ZERO,
} from "../ros";
import { BaseSettings } from "../settings";
import { makePose } from "../transforms";
import { RenderableLineStrip } from "./markers/RenderableLineStrip";

export type LayerSettingsPolygon = BaseSettings & {
  lineWidth: number;
  color: string;
};

const DEFAULT_COLOR = { r: 124 / 255, g: 107 / 255, b: 1, a: 1 };
const DEFAULT_LINE_WIDTH = 0.1;

const DEFAULT_COLOR_STR = rgbaToCssString(DEFAULT_COLOR);

const DEFAULT_SETTINGS: LayerSettingsPolygon = {
  visible: false,
  lineWidth: DEFAULT_LINE_WIDTH,
  color: DEFAULT_COLOR_STR,
};

export type PolygonUserData = BaseUserData & {
  settings: LayerSettingsPolygon;
  topic: string;
  polygonStamped: PolygonStamped;
  lines: RenderableLineStrip | undefined;
};

export class PolygonRenderable extends Renderable<PolygonUserData> {
  public override dispose(): void {
    this.userData.lines?.dispose();
    super.dispose();
  }

  public override details(): Record<string, RosValue> {
    return this.userData.polygonStamped;
  }
}

export class Polygons extends SceneExtension<PolygonRenderable> {
  public constructor(renderer: Renderer) {
    super("foxglove.Polygons", renderer);

    renderer.addDatatypeSubscriptions(POLYGON_STAMPED_DATATYPES, this.handlePolygon);
  }

  public override settingsNodes(): SettingsTreeEntry[] {
    const configTopics = this.renderer.config.topics;
    const handler = this.handleSettingsAction;
    const entries: SettingsTreeEntry[] = [];
    for (const topic of this.renderer.topics ?? []) {
      if (POLYGON_STAMPED_DATATYPES.has(topic.schemaName)) {
        const config = (configTopics[topic.name] ?? {}) as Partial<LayerSettingsPolygon>;

        // prettier-ignore
        const fields: SettingsTreeFields = {
          lineWidth: { label: "Line Width", input: "number", min: 0, placeholder: String(DEFAULT_LINE_WIDTH), step: 0.005, precision: 3, value: config.lineWidth },
          color: { label: "Color", input: "rgba", value: config.color ?? DEFAULT_COLOR_STR },
        };

        entries.push({
          path: ["topics", topic.name],
          node: {
            label: topic.name,
            icon: "Star",
            fields,
            visible: config.visible ?? DEFAULT_SETTINGS.visible,
            handler,
          },
        });
      }
    }
    return entries;
  }

  public override handleSettingsAction = (action: SettingsTreeAction): void => {
    const path = action.payload.path;
    if (action.action !== "update" || path.length !== 3) {
      return;
    }

    this.saveSetting(path, action.payload.value);

    // Update the renderable
    const topicName = path[1]!;
    const renderable = this.renderables.get(topicName);
    if (renderable) {
      const settings = this.renderer.config.topics[topicName] as
        | Partial<LayerSettingsPolygon>
        | undefined;
      renderable.userData.settings = { ...DEFAULT_SETTINGS, ...settings };
      this._updatePolygonRenderable(
        renderable,
        renderable.userData.polygonStamped,
        renderable.userData.receiveTime,
      );
    }
  };

  private handlePolygon = (messageEvent: PartialMessageEvent<PolygonStamped>): void => {
    const topic = messageEvent.topic;
    const polygonStamped = normalizePolygonStamped(messageEvent.message);
    const receiveTime = toNanoSec(messageEvent.receiveTime);

    let renderable = this.renderables.get(topic);
    if (!renderable) {
      // Set the initial settings from default values merged with any user settings
      const userSettings = this.renderer.config.topics[topic] as
        | Partial<LayerSettingsPolygon>
        | undefined;
      const settings = { ...DEFAULT_SETTINGS, ...userSettings };

      renderable = new PolygonRenderable(topic, this.renderer, {
        receiveTime,
        messageTime: toNanoSec(polygonStamped.header.stamp),
        frameId: this.renderer.normalizeFrameId(polygonStamped.header.frame_id),
        pose: makePose(),
        settingsPath: ["topics", topic],
        settings,
        topic,
        polygonStamped,
        lines: undefined,
      });

      this.add(renderable);
      this.renderables.set(topic, renderable);
    }

    this._updatePolygonRenderable(renderable, polygonStamped, receiveTime);
  };

  private _updatePolygonRenderable(
    renderable: PolygonRenderable,
    polygonStamped: PolygonStamped,
    receiveTime: bigint,
  ): void {
    const settings = renderable.userData.settings;

    renderable.userData.receiveTime = receiveTime;
    renderable.userData.messageTime = toNanoSec(polygonStamped.header.stamp);
    renderable.userData.frameId = this.renderer.normalizeFrameId(polygonStamped.header.frame_id);
    renderable.userData.polygonStamped = polygonStamped;

    const topic = renderable.userData.topic;
    const linesMarker = createLineStripMarker(polygonStamped, settings);
    if (!renderable.userData.lines) {
      renderable.userData.lines = new RenderableLineStrip(
        topic,
        linesMarker,
        receiveTime,
        this.renderer,
      );
      renderable.add(renderable.userData.lines);
    } else {
      renderable.userData.lines.update(linesMarker, receiveTime);
    }
  }
}

function createLineStripMarker(
  polygonStamped: PolygonStamped,
  settings: LayerSettingsPolygon,
): Marker {
  // Close the polygon
  const points = [...polygonStamped.polygon.points];
  if (points.length > 0) {
    points.push(points[0]!);
  }

  const linesMarker: Marker = {
    header: polygonStamped.header,
    ns: "",
    id: 0,
    type: MarkerType.LINE_STRIP,
    action: MarkerAction.ADD,
    pose: makePose(),
    scale: { x: settings.lineWidth, y: 1, z: 1 },
    color: stringToRgba(makeRgba(), settings.color),
    lifetime: TIME_ZERO,
    frame_locked: true,
    points,
    colors: [],
    text: "",
    mesh_resource: "",
    mesh_use_embedded_materials: false,
  };
  return linesMarker;
}

function normalizePolygon(polygon: PartialMessage<Polygon> | undefined): Polygon {
  return {
    points: normalizeVector3s(polygon?.points),
  };
}

function normalizePolygonStamped(polygon: PartialMessage<PolygonStamped>): PolygonStamped {
  return {
    header: normalizeHeader(polygon.header),
    polygon: normalizePolygon(polygon.polygon),
  };
}
