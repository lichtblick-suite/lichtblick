// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import * as _ from "lodash-es";

import { exportTypeScriptSchemas } from "@foxglove/schemas/internal";
import rawUserUtils from "@foxglove/studio-base/players/UserNodePlayer/nodeTransformerWorker/typescript/rawUserUtils";
import {
  ros_lib_dts,
  ros_lib_filename,
} from "@foxglove/studio-base/players/UserNodePlayer/nodeTransformerWorker/typescript/ros";
import { DEFAULT_STUDIO_NODE_PREFIX } from "@foxglove/studio-base/util/globalConstants";

import { lib_dts, lib_filename } from "./lib";
import { UserScriptProjectConfig, UserScriptProjectFile } from "./types";

/**
 * Generates virtual ts files for each type exported by the @foxglove/schemas package.
 */
export function generateFoxgloveSchemaDeclarations(): UserScriptProjectFile[] {
  const schemas = _.sortBy([...exportTypeScriptSchemas().entries()], ([name]) => name);
  const files = schemas.map(([name, sourceCode]) => {
    return {
      fileName: `@foxglove/schemas/${name}.ts`,
      filePath: `@foxglove/schemas/${name}.ts`,
      // Replace all enum declarations with const enum declarations so they can be imported
      // as a pure type and don't require any runtime typescript enum support.
      sourceCode: sourceCode.replaceAll(/export enum (\w+) {/g, "export const enum $1 {"),
    };
  });

  return files;
}

const utilityFiles: UserScriptProjectFile[] = rawUserUtils.map((utility) => ({
  ...utility,
  filePath: `${DEFAULT_STUDIO_NODE_PREFIX}${utility.fileName}`,
}));

export function getUserScriptProjectConfig(): UserScriptProjectConfig {
  const declarations: UserScriptProjectConfig["declarations"] = [];
  declarations.push({
    fileName: lib_filename,
    filePath: lib_filename,
    sourceCode: lib_dts,
  });

  declarations.push(...generateFoxgloveSchemaDeclarations());

  return {
    defaultLibFileName: lib_filename,
    rosLib: {
      fileName: ros_lib_filename,
      filePath: `/node_modules/${ros_lib_filename}`,
      sourceCode: ros_lib_dts, // Default value that is overridden.
    },
    declarations,
    utilityFiles,
  };
}
