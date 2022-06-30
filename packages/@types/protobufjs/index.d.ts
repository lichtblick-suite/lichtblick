// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import protobufjs from "protobufjs";
import descriptor from "protobufjs/ext/descriptor";

declare module "protobufjs" {
  interface ReflectionObject {
    toDescriptor(
      protoVersion: string,
    ): protobufjs.Message<descriptor.IFileDescriptorSet> & descriptor.IFileDescriptorSet;
  }
  declare namespace ReflectionObject {
    // This method is added as a side effect of importing protobufjs/ext/descriptor
    export const fromDescriptor: (desc: protobufjs.Message) => protobufjs.Root;
  }
}
