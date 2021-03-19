// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export type XmlRpcValue =
  | undefined
  | boolean
  | number
  | string
  | Date
  | Uint8Array
  | XmlRpcValue[]
  | XmlRpcStruct;

export type XmlRpcStruct = { [key: string]: XmlRpcValue };

export type Encoding =
  | "ascii"
  | "utf8"
  | "utf-8"
  | "utf16le"
  | "ucs2"
  | "ucs-2"
  | "base64"
  | "latin1"
  | "binary"
  | "hex";

export type XmlRpcMethodHandler = (methodName: string, args: XmlRpcValue[]) => Promise<XmlRpcValue>;
