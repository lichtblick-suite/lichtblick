// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { RenderableArrow } from "./RenderableArrow";
import { RenderableCube } from "./RenderableCube";
import { RenderableCubeList } from "./RenderableCubeList";
import { RenderableCylinder } from "./RenderableCylinder";
import { RenderableLineList } from "./RenderableLineList";
import { RenderableLineStrip } from "./RenderableLineStrip";
import { RenderableMarker } from "./RenderableMarker";
import { RenderableMeshResource } from "./RenderableMeshResource";
import { RenderablePoints } from "./RenderablePoints";
import { RenderableSphere } from "./RenderableSphere";
import { RenderableSphereList } from "./RenderableSphereList";
import { RenderableTextViewFacing } from "./RenderableTextViewFacing";
import { RenderableTriangleList } from "./RenderableTriangleList";
import type { Renderer } from "../../Renderer";
import { MarkerType, Marker } from "../../ros";

const CONSTRUCTORS = {
  [MarkerType.ARROW]: RenderableArrow,
  [MarkerType.CUBE]: RenderableCube,
  [MarkerType.SPHERE]: RenderableSphere,
  [MarkerType.CYLINDER]: RenderableCylinder,
  [MarkerType.LINE_STRIP]: RenderableLineStrip,
  [MarkerType.LINE_LIST]: RenderableLineList,
  [MarkerType.CUBE_LIST]: RenderableCubeList,
  [MarkerType.SPHERE_LIST]: RenderableSphereList,
  [MarkerType.POINTS]: RenderablePoints,
  [MarkerType.TEXT_VIEW_FACING]: RenderableTextViewFacing,
  [MarkerType.MESH_RESOURCE]: RenderableMeshResource,
  [MarkerType.TRIANGLE_LIST]: RenderableTriangleList,
};

/**
 * An object pool for RenderableMarker subclass objects.
 */
export class MarkerPool {
  private renderablesByType = new Map<MarkerType, RenderableMarker[]>();

  public constructor(private renderer: Renderer) {}

  public acquire<T extends MarkerType>(
    type: T,
    topic: string,
    marker: Marker,
    receiveTime: bigint | undefined,
  ): RenderableMarker {
    const renderables = this.renderablesByType.get(type);
    if (renderables) {
      const renderable = renderables.pop();
      if (renderable) {
        renderable.userData.settingsPath = ["topics", topic];
        renderable.userData.settings = { visible: true, frameLocked: marker.frame_locked };
        renderable.userData.topic = topic;
        renderable.update(marker, receiveTime);
        return renderable;
      }
    }
    const renderable = new CONSTRUCTORS[type](topic, marker, receiveTime, this.renderer);
    return renderable;
  }

  public release(renderable: RenderableMarker): void {
    const type = renderable.userData.marker.type as MarkerType;
    const renderables = this.renderablesByType.get(type);
    if (!renderables) {
      this.renderablesByType.set(type, [renderable]);
    } else {
      renderables.push(renderable);
    }
  }

  public dispose(): void {
    for (const renderables of this.renderablesByType.values()) {
      for (const renderable of renderables) {
        renderable.dispose();
      }
    }
    this.renderablesByType.clear();
  }
}
