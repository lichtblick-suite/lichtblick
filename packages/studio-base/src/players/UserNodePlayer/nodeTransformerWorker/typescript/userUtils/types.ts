import { MessageTypeByTopic, MessageTypeBySchemaName } from "./generatedTypes";

/**
 * Message is a generic type for getting the type of a message for a schema name.
 *
 * ```
 * type GeometryPose = Message<"geometry_msgs/Pose">;
 * type PkgGeometryPose = Message<"pkg.geometry.Pose">;
 * ```
 */
export type Message<T extends keyof MessageTypeBySchemaName> = MessageTypeBySchemaName[T];

/**
 * Input type is a generic type for getting the event type on a topic.
 *
 * Most commonly used to type the input argument to your process function.
 *
 * ```
 * function process(msgEvent: Input<"/points">) { ... }
 * ```
 */
export type Input<T extends keyof MessageTypeByTopic> = {
  topic: T;
  receiveTime: Time;
  message: MessageTypeByTopic[T];
};

export type RGBA = {
  // all values are scaled between 0-1 instead of 0-255
  r: number;
  g: number;
  b: number;
  a: number; // opacity -- typically you should set this to 1.
};

export type Header = {
  frame_id: string;
  stamp: Time;
  seq: number;
};

export type Point = {
  x: number;
  y: number;
  z: number;
};

export type Time = {
  sec: number;
  nsec: number;
};

export type Translation = {
  x: number;
  y: number;
  z: number;
};

export type Rotation = {
  x: number;
  y: number;
  z: number;
  w: number;
};

export type Pose = {
  position: Point;
  orientation: Quaternion;
};

export type Quaternion = {
  x: number;
  y: number;
  z: number;
  w: number;
};

export type Transform = {
  header: Header;
  child_frame_id: string;
  transform: {
    translation: Translation;
    rotation: Rotation;
  };
};
