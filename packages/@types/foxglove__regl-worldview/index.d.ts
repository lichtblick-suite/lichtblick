// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

/* eslint-disable @typescript-eslint/no-explicit-any */

import type REGL from "regl";

// Support for nested like "foo.length" in regl props
type PropType<Props, Key> = Key extends `${infer K1}.${infer K2}`
  ? PropType<PropType<Props, K1>, K2>
  : Props[Key];

// Overrides regl's definition of prop for better type inference
declare module "regl" {
  export interface Regl {
    prop<Context extends REGL.DefaultContext, Props, K extends string>(
      key: K,
    ): REGL.MaybeDynamic<PropType<Props, K>, Context, Props>;
  }
}

declare module "@foxglove/regl-worldview" {
  export interface Color {
    r: number;
    g: number;
    b: number;
    a: number;
  }

  type Point = { x: number; y: number; z: number };
  type Position = Point;
  type Orientation = { x: number; y: number; z: number; w: number };
  type Pose = { position: Position; orientation: Orientation };

  class PolygonBuilder {
    polygons: any;
    onChange: any;

    constructor(polygons?: Polygon[]);

    onMouseMove: MouseHandler;
    onMouseUp: MouseHandler;
    onDoubleClick: MouseHandler;
    onMouseDown: MouseHandler;
  }

  interface CommonCommandProps {
    layerIndex?: any;
  }

  export class Ray {
    origin: Vec3;
    dir: Vec3;
    point: Vec3;
    distanceToPoint(point: Vec3): number;
    // eslint-disable-next-line no-restricted-syntax
    planeIntersection(planeCoordinate: Vec3, planeNormal: Vec3): Vec3 | null;
  }

  type ClickedObject = {
    object: unknown;
    instanceIndex?: number;
  };
  interface ReglClickInfo {
    ray: Ray;
    objects: ClickedObject[];
  }

  interface Arrow {
    pose: any;
    scale: any;
    color: any;
    settings: any;
    interactionData: any;
  }

  function pointToVec3(arg: any): any;
  function orientationToVec4(arg: any): any;
  function vec3ToPoint(arg: any): any;
  function withPose<Uniforms, Attributes, Props, OwnContext, ParentContext>(
    arg: REGL.DrawConfig<Uniforms, Attributes, Props, OwnContext, ParentContext>,
  ): REGL.DrawConfig<Uniforms, Attributes, Props, OwnContext, ParentContext>;
  function parseGLB(arg: any): any;
  function vec4ToRGBA(arg: any): any;
  function toRGBA(arg: any): any;
  function nonInstancedGetChildrenForHitmap<T>(
    props: T,
    assignNextColors: AssignNextColorsFn,
    excludedObjects: MouseEventObject[],
  ): T extends unknown[] ? T : T | undefined;
  function getChildrenForHitmapWithOriginalMarker<T>(
    props: T,
    assignNextColors: AssignNextColorsFn,
    excludedObjects: MouseEventObject[],
  ): T extends unknown[] ? T : T | undefined;
  function shouldConvert(arg: any): boolean;

  // jsx elements
  const Arrows: any;
  const Worldview: any;
  const Command: any;
  const GLTFScene: any;
  const Triangles: any;
  const Lines: any;
  const DrawPolygons: any;

  class Polygon {
    points: any;
    constructor(name: string);
  }
  class PolygonPoint {
    constructor(point: Vec3);
  }

  type MouseEventObject = {
    object: BaseShape;
    instanceIndex?: number;
  };
  type Vec3 = readonly [number, number, number];
  type Vec4 = readonly [number, number, number, number];
  type CameraState = {
    distance: number;
    perspective: boolean;
    phi: number;
    target: Vec3;
    targetOffset: Vec3;
    targetOrientation: Vec4;
    thetaOffset: number;
    fovy: number;
    near: number;
    far: number;
  };
  type CameraStateSelectors = any;
  type Scale = any;
  type Pose = any;
  type Regl = REGL.Regl;
  type AssignNextColorsFn = (object: unknown, count: number) => Vec4[];

  export type BaseShape = {
    pose: Pose;
    scale: Scale;
    color?: Color | Vec4;
  };
  type Line = BaseShape & {
    points: readonly (Point | Vec3)[];
    poses?: readonly Pose[];
  };
  type TriangleList = any;
  type MouseHandler = (event: React.MouseEvent, clickInfo: ReglClickInfo) => void;

  // vars
  const DEFAULT_CAMERA_STATE: CameraState;
  const defaultBlend: any;
  const cameraStateSelectors: CameraStateSelectors;

  type CameraKeyMap = any;
  class CameraStore {
    constructor(handler: (state: CameraState) => void, initialCameraState: Partial<CameraState>);
    setCameraState(state: Partial<CameraState>): void;
  }

  const CameraListener: React.ComponentClass<
    React.PropsWithChildren<{
      cameraStore: CameraStore;
      keyMap?: CameraKeyMap;
      shiftKeys: boolean;
    }>
  >;

  type Dimensions = { width: number; height: number; top: number; left: number };
  class Overlay<T> extends React.Component<
    {
      renderItem: (_: {
        item: T;
        coordinates?: Vec3;
        index: number;
        dimension: Dimensions;
      }) => React.ReactNode;
    },
    unknown
  > {}

  export {
    DEFAULT_CAMERA_STATE,
    Scale,
    Pose,
    Command,
    Polygon,
    PolygonBuilder,
    ReglClickInfo,
    CommonCommandProps,
    Arrow,
    Arrows,
    pointToVec3,
    vec3ToPoint,
    orientationToVec4,
    Worldview,
    withPose,
    parseGLB,
    defaultBlend,
    cameraStateSelectors,
    CameraStateSelectors,
    CameraState,
    CameraStore,
    CameraListener,
    MouseEventObject,
    GLTFScene,
    vec4ToRGBA,
    Regl,
    AssignNextColorsFn,
    nonInstancedGetChildrenForHitmap,
    getChildrenForHitmapWithOriginalMarker,
    toRGBA,
    Triangles,
    Lines,
    Line,
    TriangleList,
    shouldConvert,
    PolygonPoint,
    DrawPolygons,
    MouseHandler,
    Cubes,
    Cylinders,
    GLText,
    Points,
    Spheres,
    Overlay,
    createInstancedGetChildrenForHitmap,
    Vec3,
    Vec4,
    WorldviewContextType,
    WorldviewReactContext,
    Point,
  };
}
