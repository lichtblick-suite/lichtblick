// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { XacroParser } from "xacro-parser";

import { parseUrdf } from "./parser";
import { UrdfRobot } from "./types";

export * from "./types";

export async function parseRobot(
  urdfContents: string,
  getFileContents: (url: string) => Promise<string>,
): Promise<UrdfRobot> {
  const xacroParser = new XacroParser();
  xacroParser.rospackCommands = { find: (targetPkg) => `package://${targetPkg}` };
  xacroParser.getFileContents = getFileContents;

  const urdf = await xacroParser.parse(urdfContents);
  return parseUrdf(urdf);
}
