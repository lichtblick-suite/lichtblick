// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { group } from "@actions/core";
import { exec as execAction } from "@actions/exec";

export async function exec(program: string, ...args: string[]): Promise<void> {
  await group(`$ ${program} ${args?.join(" ")}`, async () => {
    await execAction(program, args);
  });
}

export async function execOutput(program: string, ...args: string[]): Promise<string> {
  let output = "";
  await execAction(program, args, {
    silent: true,
    listeners: {
      stdout: (data) => {
        output += data.toString();
      },
    },
  });

  return output;
}
