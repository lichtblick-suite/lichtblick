// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { mkdir, readdir, readFile, writeFile } from "fs/promises";
import { join, basename, sep } from "path";
import { format, Options } from "prettier";

import { parse, RosMsgDefinition } from "@foxglove/rosmsg";

const LICENSE = `// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/`;

const PRETTIER_OPTS: Options = {
  parser: "babel",
  arrowParens: "always",
  printWidth: 100,
  trailingComma: "all",
  tabWidth: 2,
  semi: true,
};

async function main() {
  const msgdefsPath = join(__dirname, "..", "msgdefs");
  const distDir = join(__dirname, "..", "dist");
  const libFile = join(distDir, "index.js");
  const declFile = join(distDir, "index.d.ts");
  const definitions: Record<string, RosMsgDefinition> = {};

  const msgFiles = await getMsgFiles(msgdefsPath);
  for (const filename of msgFiles) {
    const dataType = filenameToDataType(filename);
    const msgdef = await readFile(filename, { encoding: "utf8" });
    const schema = parse(msgdef);
    (schema[0] as RosMsgDefinition).name = dataType;
    for (const entry of schema) {
      if (entry.name == undefined) {
        throw new Error(`Failed to parse ${dataType} from ${filename}`);
      }
      definitions[entry.name] = entry;
    }
  }

  const libOutput = generateLibrary(definitions);
  const declOutput = generateDefinitions(definitions);

  await mkdir(distDir, { recursive: true });
  await writeFile(libFile, libOutput);
  await writeFile(declFile, declOutput);
}

async function getMsgFiles(dir: string): Promise<string[]> {
  let output: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      output = output.concat(await getMsgFiles(join(dir, entry.name)));
    } else if (entry.isFile() && entry.name.endsWith(".msg")) {
      output.push(join(dir, entry.name));
    }
  }
  return output;
}

function filenameToDataType(filename: string): string {
  const parts = filename.split(sep);
  return `${parts[parts.length - 2]}/${basename(filename, ".msg")}`;
}

function generateLibrary(definitions: Record<string, RosMsgDefinition>): string {
  return format(
    `${LICENSE}

const definitions = ${JSON.stringify(definitions)}

module.exports = { definitions };
`,
    PRETTIER_OPTS,
  );
}

function generateDefinitions(definitions: Record<string, RosMsgDefinition>): string {
  const entries = Object.keys(definitions)
    .sort()
    .map((key) => `    "${key}": RosMsgDefinition;`)
    .join("\n");
  return `${LICENSE}

import { RosMsgDefinition } from "@foxglove/rosmsg";

declare module "@foxglove/rosmsg-msgs-common" {
  type RosMsgCommonDefinitions = {
${entries}
  };

  const definitions: RosMsgCommonDefinitions;
  export { definitions };
}
`;
}

void main();
