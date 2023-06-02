// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/** Want to render after all other objects in the scene so that they are not occluded by other objects */
const ANNOTATION_FRONT_POSITION = 100000;

/** Render order for given annotations. Higher numbers rendered after lower numbers */
export const ANNOTATION_RENDER_ORDER = {
  FILL: 1 + ANNOTATION_FRONT_POSITION,
  LINE_PREPASS: 2 + ANNOTATION_FRONT_POSITION,
  LINE: 3 + ANNOTATION_FRONT_POSITION,
  POINTS: 4 + ANNOTATION_FRONT_POSITION,
  TEXT: 5 + ANNOTATION_FRONT_POSITION,
};

/** we want annotations to show on top of the entire scene. These are material props to achieve that */
export const annotationRenderOrderMaterialProps = {
  /** We need to set transparent to true so that transparent objects aren't rendered on top of it.
   * Transparent objects are rendered after non-transparent objects. If this were set to false or
   * set based on color of annotations, then the foreground image with opacity would be rendered on top
   * until it is fully opaque.
   */
  transparent: true,
  depthWrite: false,
  depthTest: false,
};
