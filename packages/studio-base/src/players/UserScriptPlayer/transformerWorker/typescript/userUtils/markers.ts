import { Header, Pose, Point, RGBA, Time } from "./types";

export interface IMarker {
  header: Header;
  ns: string;
  id: number;
  type: number;
  action: number;
  pose: Pose;
  scale: Point;
  color: RGBA;
  lifetime: Time;
  frame_locked: boolean;
  points: Point[];
  colors: RGBA[];
  text: string;
  mesh_resource: string;
  mesh_use_embedded_materials: boolean;
}

export type IRosMarker = IMarker;

export interface ImageMarker {
  header: Header;
  ns: string;
  id: number;
  type: number;
  action: number;
  position: Point;
  scale: number;
  outline_color: RGBA;
  filled: boolean;
  fill_color: RGBA;
  lifetime: Time;
  points: Point[];
  outline_colors: RGBA[];
}

/**
 * buildRosMarker builds a complete Marker message from an optional set of args.
 *
 * See https://foxglove.dev/docs/panels/3d for a list of supported Marker types
 *
 * @param args override any defaults in the marker fields
 * @returns an IRosMarker instance with default values for any omitted args
 */
export function buildRosMarker(args?: Partial<IRosMarker>): IRosMarker {
  const {
    header,
    ns,
    id,
    type,
    action,
    pose,
    scale,
    color,
    lifetime,
    frame_locked,
    points,
    colors,
    text,
    mesh_resource,
    mesh_use_embedded_materials,
  } = args ?? {};

  return {
    header: header ?? {
      frame_id: "",
      stamp: {
        sec: 0,
        nsec: 0,
      },
      seq: 0,
    },
    ns: ns ?? "",
    id: id ?? 0,
    type: type ?? 0,
    action: action ?? 0,
    pose: pose ?? {
      position: {
        x: 0,
        y: 0,
        z: 0,
      },
      orientation: {
        x: 0,
        y: 0,
        z: 0,
        w: 0,
      },
    },
    scale: scale ?? { x: 0, y: 0, z: 0 },
    color: color ?? { r: 0, g: 0, b: 0, a: 0 },
    lifetime: lifetime ?? { sec: 0, nsec: 0 },
    frame_locked: frame_locked ?? false,
    points: points ?? [],
    colors: colors ?? [],
    text: text ?? "",
    mesh_resource: mesh_resource ?? "",
    mesh_use_embedded_materials: mesh_use_embedded_materials ?? false,
  };
}

/**
 * buildImageMarker builds a complete Marker message from an optional set of args.
 *
 * See https://foxglove.dev/docs/studio/panels/image for a list of supported Marker types
 *
 * @param args override any defaults in the marker fields
 * @returns an ImageMarker instance with default values for any omitted args
 */
export function buildImageMarker(args?: Partial<ImageMarker>): ImageMarker {
  const {
    header,
    ns,
    id,
    type,
    action,
    lifetime,
    points,
    outline_color,
    outline_colors,
    filled,
    fill_color,
    position,
    scale,
  } = args ?? {};

  return {
    header: header ?? {
      frame_id: "",
      stamp: {
        sec: 0,
        nsec: 0,
      },
      seq: 0,
    },
    ns: ns ?? "",
    id: id ?? 0,
    type: type ?? 0,
    action: action ?? 0,
    position: position ?? {
      x: 0,
      y: 0,
      z: 0,
    },
    scale: scale ?? 1,
    outline_color: outline_color ?? { r: 0, g: 0, b: 0, a: 0 },
    lifetime: lifetime ?? { sec: 0, nsec: 0 },
    points: points ?? [],
    outline_colors: outline_colors ?? [],
    filled: filled ?? false,
    fill_color: fill_color ?? { r: 0, g: 0, b: 0, a: 0 },
  };
}

/**
 * Use this class to instantiate marker-like objects with defaulted values.
 *
 * @deprecated prefer `buildRosMarker({ ... })` instead
 */
export class Marker implements IMarker {
  public header: Header = {
    frame_id: "",
    stamp: {
      sec: 0,
      nsec: 0,
    },
    seq: 0,
  };
  public ns = "";
  public id = 0;
  public type = 0;
  public action = 0;
  public pose: Pose = {
    position: {
      x: 0,
      y: 0,
      z: 0,
    },
    orientation: {
      x: 0,
      y: 0,
      z: 0,
      w: 0,
    },
  };
  public scale: Point = {
    x: 0,
    y: 0,
    z: 0,
  };
  public color: RGBA = { r: 0, g: 0, b: 0, a: 0 };
  public lifetime: Time = { sec: 0, nsec: 0 };
  public frame_locked = false;
  public points: Point[] = [];
  public colors: RGBA[] = [];
  public text = "";
  public mesh_resource = "";
  public mesh_use_embedded_materials = false;

  public constructor({
    header,
    ns,
    id,
    type,
    action,
    pose,
    scale,
    color,
    lifetime,
    frame_locked,
    points,
    colors,
    text,
    mesh_resource,
    mesh_use_embedded_materials,
  }: Partial<IMarker>) {
    this.header = header ?? {
      frame_id: "",
      stamp: {
        sec: 0,
        nsec: 0,
      },
      seq: 0,
    };
    this.ns = ns ?? "";
    this.id = id ?? 0;
    this.type = type ?? 0;
    this.action = action ?? 0;
    this.pose = pose ?? {
      position: {
        x: 0,
        y: 0,
        z: 0,
      },
      orientation: {
        x: 0,
        y: 0,
        z: 0,
        w: 0,
      },
    };
    this.scale = scale ?? { x: 0, y: 0, z: 0 };
    this.color = color ?? { r: 0, g: 0, b: 0, a: 0 };
    this.lifetime = lifetime ?? { sec: 0, nsec: 0 };
    this.frame_locked = frame_locked ?? false;
    this.points = points ?? [];
    this.colors = colors ?? [];
    this.text = text ?? "";
    this.mesh_resource = mesh_resource ?? "";
    this.mesh_use_embedded_materials = mesh_use_embedded_materials ?? false;
  }
}
/**
 * Corresponds to the 'type' field of a marker.
 */
export enum MarkerTypes {
  ARROW = 0,
  CUBE = 1,
  SPHERE = 2,
  CYLINDER = 3,
  LINE_STRIP = 4,
  LINE_LIST = 5,
  CUBE_LIST = 6,
  SPHERE_LIST = 7,
  POINTS = 8,
  TEXT = 9,
  MESH = 10,
  TRIANGLE_LIST = 11,
}
