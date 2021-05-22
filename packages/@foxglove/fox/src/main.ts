// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import program from "commander";

import { fatal } from "./log";
import { installCommand, packageCommand } from "./package";

function main(task: Promise<void>): void {
  task.catch(fatal);
}

module.exports = function (argv: string[]): void {
  program.usage("<command> [options]");

  program
    .command("package")
    .description("Packages an extension")
    .option("-o, --out [path]", "Output .foxe extension file to [path] location")
    .action(({ out }) => main(packageCommand({ packagePath: out })));

  program
    .command("install")
    .description("Locally installs an extension")
    .action(() => main(installCommand()));

  program.on("command:*", ([_cmd]: string) => {
    program.outputHelp({ error: true });
    process.exit(1);
  });

  program.parse(argv);
};
