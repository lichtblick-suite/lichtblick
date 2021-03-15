// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import type { RosMsgField, Time } from "rosbag";

export type RosDatatype = {
  fields: RosMsgField[];
};

export type RosDatatypes = {
  [key: string]: RosDatatype;
};

// A ROS-like message.
export type TypedMessage<T> = Readonly<{
  topic: string;
  receiveTime: Time;

  // The actual message format. This is currently not very tightly defined, but it's typically
  // JSON-serializable, with the exception of typed arrays
  // (see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Typed_arrays).
  message: Readonly<T>;
}>;

export type Message = TypedMessage<any>;

export interface BinaryDefinition {
  getSize(): number;
}

export type BinaryObjects = Readonly<{
  dataType: string;
  offsets: readonly number[];
  buffer: ArrayBuffer;
  bigString: string;
}>;

export const DefinitionCommand = {
  READ_FIXED_SIZE_DATA: 0,
  READ_STRING: 1,
  READ_DYNAMIC_SIZE_DATA: 2,
  CONSTANT_ARRAY: 3,
  DYNAMIC_ARRAY: 4,
};
