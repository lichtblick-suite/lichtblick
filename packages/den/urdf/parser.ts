// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/* eslint-disable @typescript-eslint/prefer-for-of, @typescript-eslint/no-base-to-string */

import {
  Color,
  Inertia,
  JointType,
  Pose,
  UrdfCollider,
  UrdfGeometry,
  UrdfInertial,
  UrdfJoint,
  UrdfLink,
  UrdfMaterial,
  UrdfRobot,
  UrdfVisual,
  Vector3,
} from "./types";

const JOINT_TYPES = ["fixed", "continuous", "revolute", "planar", "prismatic", "floating"];

export function parseUrdf(xml: XMLDocument | string): UrdfRobot {
  const parser = new DOMParser();
  const urdf =
    xml instanceof XMLDocument ? xml : (parser.parseFromString(xml, "text/xml") as XMLDocument);

  for (let i = 0; i < urdf.children.length; i++) {
    const child = urdf.children[i]!;
    if (child.nodeName === "robot") {
      return parseRobot(child);
    }
  }

  throw new Error(`No robot found in URDF`);
}

function parseRobot(xml: Element): UrdfRobot {
  const name = xml.getAttribute("name") ?? undefined;
  if (name == undefined) {
    throw new Error("<robot> name is missing");
  }
  const links = new Map<string, UrdfLink>();
  const joints = new Map<string, UrdfJoint>();
  const materials = new Map<string, UrdfMaterial>();

  for (let i = 0; i < xml.children.length; i++) {
    const child = xml.children[i]!;
    const childName = child.getAttribute("name");
    if (childName == undefined) {
      continue;
    }

    switch (child.nodeName) {
      case "link":
        links.set(childName, parseLink(child));
        break;
      case "joint":
        joints.set(childName, parseJoint(child));
        break;
      case "material":
        materials.set(childName, parseMaterial(child));
        break;
    }
  }

  return { name, links, joints, materials };
}

function parseLink(xml: Element): UrdfLink {
  const name = xml.getAttribute("name") ?? undefined;
  if (name == undefined) {
    throw new Error(`missing attribute "name" in ${xml}`);
  }

  const link: UrdfLink = { name, visuals: [], colliders: [] };

  for (let i = 0; i < xml.children.length; i++) {
    const child = xml.children[i]!;
    switch (child.nodeName) {
      case "inertial":
        link.inertial = parseInertial(child);
        break;
      case "visual":
        link.visuals.push(parseVisual(child));
        break;
      case "collision":
        link.colliders.push(parseCollision(child));
        break;
    }
  }

  return link;
}

function parseInertial(xml: Element): UrdfInertial {
  let origin: Pose | undefined;
  let mass: number | undefined;
  let inertia: Inertia | undefined;

  for (let i = 0; i < xml.children.length; i++) {
    const child = xml.children[i]!;
    switch (child.nodeName) {
      case "origin":
        origin = parsePose(child);
        break;
      case "mass":
        mass = parseFloatContent(child);
        break;
      case "inertia":
        inertia = parseInertia(child);
        break;
    }
  }

  if (mass == undefined || inertia == undefined) {
    throw new Error("<inertial> must have mass and inertia");
  }

  return { origin: origin ?? defaultPose(), mass, inertia };
}

function parseJoint(xml: Element): UrdfJoint {
  const name = xml.getAttribute("name") ?? undefined;
  const jointType = xml.getAttribute("type") ?? undefined;
  let origin: Pose | undefined;
  let parentLink: string | undefined;
  let childLink: string | undefined;
  let axis: Vector3 | undefined;
  let calibration: { rising?: number; falling?: number } | undefined;
  let dynamics: { damping: number; friction: number } | undefined;
  let limit: { lower: number; upper: number; effort: number; velocity: number } | undefined;
  let mimic: { joint: string; multiplier: number; offset: number } | undefined;
  let safetyController:
    | {
        softLowerLimit: number;
        softUpperLimit: number;
        kPosition: number;
        kVelocity: number;
      }
    | undefined;

  if (name == undefined) {
    throw new Error(`missing attribute "name" in ${xml}`);
  }
  if (!JOINT_TYPES.includes(jointType ?? "")) {
    throw new Error(`invalid joint type "${jointType}" in ${xml}`);
  }

  for (let i = 0; i < xml.children.length; i++) {
    const child = xml.children[i]!;
    switch (child.nodeName) {
      case "origin":
        origin = parsePose(child);
        break;
      case "parent":
        parentLink = child.getAttribute("link") ?? undefined;
        break;
      case "child":
        childLink = child.getAttribute("link") ?? undefined;
        break;
      case "axis":
        axis = parseVec3Attribute(child, "xyz");
        if (axis == undefined) {
          throw new Error(`missing attribute "xyz" in ${child}`);
        }
        break;
      case "calibration":
        calibration = {
          rising: parseFloatAttributeOptional(child, "rising"),
          falling: parseFloatAttributeOptional(child, "falling"),
        };
        break;
      case "dynamics":
        dynamics = {
          damping: parseFloatAttributeOptional(child, "damping") ?? 0,
          friction: parseFloatAttributeOptional(child, "friction") ?? 0,
        };
        break;
      case "limit":
        limit = {
          lower: parseFloatAttributeOptional(child, "lower") ?? 0,
          upper: parseFloatAttributeOptional(child, "upper") ?? 0,
          effort: parseFloatAttribute(child, "effort"),
          velocity: parseFloatAttribute(child, "velocity"),
        };
        break;
      case "mimic": {
        const joint = child.getAttribute("joint") ?? undefined;
        if (joint == undefined) {
          throw new Error(`missing attribute "joint" in ${child}`);
        }
        mimic = {
          joint,
          multiplier: parseFloatAttributeOptional(child, "multiplier") ?? 1,
          offset: parseFloatAttributeOptional(child, "offset") ?? 0,
        };
        break;
      }
      case "safety_controller":
        safetyController = {
          softLowerLimit: parseFloatAttributeOptional(child, "soft_lower_limit") ?? 0,
          softUpperLimit: parseFloatAttributeOptional(child, "soft_upper_limit") ?? 0,
          kPosition: parseFloatAttributeOptional(child, "k_position") ?? 0,
          kVelocity: parseFloatAttribute(child, "k_velocity"),
        };
        break;
    }
  }

  if (parentLink == undefined || childLink == undefined) {
    throw new Error(`missing parent or child in ${xml}`);
  }

  return {
    name,
    jointType: jointType as JointType,
    origin: origin ?? defaultPose(),
    parent: parentLink,
    child: childLink,
    axis: axis ?? { x: 1, y: 0, z: 0 },
    calibration,
    dynamics,
    limit,
    mimic,
    safetyController,
  };
}

function parseVisual(xml: Element): UrdfVisual {
  const name = xml.getAttribute("name") ?? undefined;
  let origin: Pose | undefined;
  let geometry: UrdfGeometry | undefined;
  let material: UrdfMaterial | undefined;

  for (let i = 0; i < xml.children.length; i++) {
    const child = xml.children[i]!;
    switch (child.nodeName) {
      case "origin":
        origin = parsePose(child);
        break;
      case "geometry":
        geometry = parseGeometry(child);
        break;
      case "material":
        material = parseMaterial(child);
        break;
    }
  }

  if (geometry == undefined) {
    throw new Error("<visual> must have geometry");
  }

  return { name, origin: origin ?? defaultPose(), geometry, material };
}

function parseCollision(xml: Element): UrdfCollider {
  const name = xml.getAttribute("name") ?? undefined;
  let origin: Pose | undefined;
  let geometry: UrdfGeometry | undefined;

  for (let i = 0; i < xml.children.length; i++) {
    const child = xml.children[i]!;
    switch (child.nodeName) {
      case "origin":
        origin = parsePose(child);
        break;
      case "geometry":
        geometry = parseGeometry(child);
        break;
    }
  }

  if (geometry == undefined) {
    throw new Error("<collision> must have geometry");
  }

  return { name, origin: origin ?? defaultPose(), geometry };
}

function parseMaterial(xml: Element): UrdfMaterial {
  const name = xml.getAttribute("name") ?? undefined;
  let color: Color | undefined;
  let texture: string | undefined;

  for (let i = 0; i < xml.children.length; i++) {
    const child = xml.children[i]!;
    switch (child.nodeName) {
      case "color":
        color = parseColorAttribute(child, "rgba");
        break;
      case "texture":
        texture = child.getAttribute("filename") ?? undefined;
        break;
    }
  }

  return { name, color, texture };
}

function parseInertia(xml: Element): Inertia {
  const ixx = parseFloatAttribute(xml, "ixx");
  const ixy = parseFloatAttribute(xml, "ixy");
  const ixz = parseFloatAttribute(xml, "ixz");
  const iyy = parseFloatAttribute(xml, "iyy");
  const iyz = parseFloatAttribute(xml, "iyz");
  const izz = parseFloatAttribute(xml, "izz");
  return { ixx, ixy, ixz, iyy, iyz, izz };
}

function parseGeometry(xml: Element): UrdfGeometry {
  if (xml.children.length < 1) {
    throw new Error("<geometry> must contain box, cylinder, sphere, or mesh");
  }

  const child = xml.children[0]!;
  switch (child.nodeName) {
    case "box": {
      const size = parseVec3Attribute(child, "size");
      if (size == undefined) {
        throw new Error(`missing attribute "size" in ${xml}`);
      }
      return { geometryType: "box", size };
    }
    case "cylinder": {
      const length = parseFloatAttribute(child, "length");
      const radius = parseFloatAttribute(child, "radius");
      return { geometryType: "cylinder", length, radius };
    }
    case "sphere": {
      const radius = parseFloatAttribute(child, "radius");
      return { geometryType: "sphere", radius };
    }
    case "mesh": {
      const filename = child.getAttribute("filename") ?? undefined;
      const scale = parseVec3Attribute(child, "scale");
      if (filename == undefined) {
        throw new Error(`missing attribute "filename" in ${xml}`);
      }
      return { geometryType: "mesh", filename, scale };
    }
    default:
      throw new Error("<geometry> must contain box, cylinder, sphere, or mesh");
  }
}

function parsePose(xml: Element): Pose {
  const xyz = parseVec3Attribute(xml, "xyz") ?? { x: 0, y: 0, z: 0 };
  const rpy = parseVec3Attribute(xml, "rpy") ?? { x: 0, y: 0, z: 0 };
  return { xyz, rpy };
}

function parseVec3Attribute(xml: Element, attribName: string): Vector3 | undefined {
  const parts = xml.getAttribute(attribName)?.trim().split(/\s+/);
  if (parts?.length !== 3) {
    return undefined;
  }

  const [x, y, z] = parts as [string, string, string];
  return { x: parseFloat(x), y: parseFloat(y), z: parseFloat(z) };
}

function parseColorAttribute(xml: Element, attribName: string): Color | undefined {
  const parts = xml.getAttribute(attribName)?.trim().split(/\s+/);
  if (parts?.length !== 4) {
    return undefined;
  }

  const [r, g, b, a] = parts as [string, string, string, string];
  return { r: parseFloat(r), g: parseFloat(g), b: parseFloat(b), a: parseFloat(a) };
}

function parseFloatAttribute(xml: Element, attribName: string): number {
  const value = xml.getAttribute(attribName);
  if (value == undefined) {
    throw new Error(`missing attribute "${attribName}" in ${xml}`);
  }
  return parseFloat(value);
}

function parseFloatAttributeOptional(xml: Element, attribName: string): number | undefined {
  const value = xml.getAttribute(attribName);
  if (value == undefined) {
    return undefined;
  }
  return parseFloat(value);
}

function parseFloatContent(xml: Element): number {
  if (xml.textContent == undefined) {
    throw new Error(`expected float value in "${xml}"`);
  }
  return parseFloat(xml.textContent);
}

function defaultPose(): Pose {
  return { xyz: { x: 0, y: 0, z: 0 }, rpy: { x: 0, y: 0, z: 0 } };
}
