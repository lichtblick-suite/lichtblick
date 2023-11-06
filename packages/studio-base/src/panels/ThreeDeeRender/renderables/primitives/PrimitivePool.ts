// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { RenderableArrows } from "./RenderableArrows";
import { RenderableCubes } from "./RenderableCubes";
import { RenderableCylinders } from "./RenderableCylinders";
import { RenderableLines } from "./RenderableLines";
import { RenderableModels } from "./RenderableModels";
import { RenderablePrimitive } from "./RenderablePrimitive";
import { RenderableSpheres } from "./RenderableSpheres";
import { RenderableTexts } from "./RenderableTexts";
import { RenderableTriangles } from "./RenderableTriangles";
import { PrimitiveType } from "./types";
import type { IRenderer } from "../../IRenderer";

const CONSTRUCTORS = {
  [PrimitiveType.CUBES]: RenderableCubes,
  [PrimitiveType.MODELS]: RenderableModels,
  [PrimitiveType.LINES]: RenderableLines,
  [PrimitiveType.CYLINDERS]: RenderableCylinders,
  [PrimitiveType.ARROWS]: RenderableArrows,
  [PrimitiveType.SPHERES]: RenderableSpheres,
  [PrimitiveType.TEXTS]: RenderableTexts,
  [PrimitiveType.TRIANGLES]: RenderableTriangles,
};

/**
 * An object pool for RenderablePrimitive subclass objects.
 */
export class PrimitivePool {
  #primitivesByType = new Map<PrimitiveType, RenderablePrimitive[]>();
  #disposed = false;

  public constructor(private renderer: IRenderer) {}

  public acquire<T extends PrimitiveType>(type: T): InstanceType<(typeof CONSTRUCTORS)[T]> {
    if (this.#disposed) {
      throw new Error(`Attempt to acquire PrimitiveType.${type} after PrimitivePool was disposed`);
    }
    // Using shift allows renderables to be reused for the same entities after a seek
    // This avoids unnecessary `ensureCapacity` calls for instanced renderables
    const primitive = this.#primitivesByType.get(type)?.shift();
    if (primitive) {
      primitive.prepareForReuse();
      return primitive as InstanceType<(typeof CONSTRUCTORS)[T]>;
    }
    // https://github.com/microsoft/TypeScript/issues/44049
    return new CONSTRUCTORS[type](this.renderer) as InstanceType<(typeof CONSTRUCTORS)[T]>;
  }

  public release<T extends PrimitiveType>(
    type: T,
    primitive: InstanceType<(typeof CONSTRUCTORS)[T]>,
  ): void {
    if (this.#disposed) {
      primitive.dispose();
      return;
    }
    const primitives = this.#primitivesByType.get(type);
    if (!primitives) {
      this.#primitivesByType.set(type, [primitive]);
    } else {
      primitives.push(primitive);
    }
  }

  public dispose(): void {
    for (const primitives of this.#primitivesByType.values()) {
      for (const primitive of primitives) {
        primitive.dispose();
      }
    }
    this.#primitivesByType.clear();
    this.#disposed = true;
  }

  public setColorScheme(colorScheme: "dark" | "light"): void {
    for (const primitives of this.#primitivesByType.values()) {
      for (const primitive of primitives) {
        primitive.setColorScheme(colorScheme);
      }
    }
  }
}
