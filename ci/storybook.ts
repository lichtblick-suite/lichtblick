// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  ArgumentParser,
  ONE_OR_MORE,
  RawDescriptionHelpFormatter,
  ArgumentTypeError,
} from "argparse";

import { exec } from "./exec";

enum Command {
  start = "start",
  build = "build",
  capture = "capture",
  publish = "publish",
}

async function main(): Promise<void> {
  const parser = new ArgumentParser({
    formatter_class: RawDescriptionHelpFormatter,
    description: `
  Run storybook, capture screenshots, and upload with reg-suit.

  Use commands:
    start - Run start-storybook
    build - Run build-storybook
    capture - Run storycap
    publish - Run reg-suit and publish results to GitHub
  `.trim(),
  });
  parser.add_argument("--local", {
    action: "store_true",
    help: "Disable parallel execution for local debugging",
  });
  parser.add_argument("--headful", {
    action: "store_true",
    help: "Disable headless mode for local debugging",
  });
  parser.add_argument("--verbose", {
    action: "store_true",
    help: "Enable storycap verbose output",
  });
  parser.add_argument("command", {
    nargs: ONE_OR_MORE,
    help: "Sub-commands to run",
    type: (arg: string): Command => {
      const command: Command | undefined = Command[arg as Command];
      if (command != undefined) {
        return command;
      }
      throw new ArgumentTypeError(`Unrecognized command ${arg}`);
    },
  });

  // Show help if no args passed
  // First two argv are node interpreter and this script
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    argv.push("-h");
  }

  const args = parser.parse_args(argv);

  const storybookEnv = {
    env: {
      ...process.env,
      NODE_OPTIONS: "--max-old-space-size=6144",
      TS_NODE_COMPILER_OPTIONS: '{"module":"commonjs"}',
    },
  };

  if (args.command.includes(Command.start)) {
    await exec(
      "yarn",
      [
        "workspace",
        "@foxglove/studio-base",
        "run",
        "start-storybook",
        "--config-dir",
        "src/.storybook",
      ],
      storybookEnv,
    );
    return;
  }

  if (args.command.includes(Command.build)) {
    await exec(
      "yarn",
      [
        "workspace",
        "@foxglove/studio-base",
        "run",
        "build-storybook",
        "--config-dir",
        "src/.storybook",
      ],
      storybookEnv,
    );
  }

  if (args.command.includes(Command.capture)) {
    await exec("yarn", [
      "workspace",
      "@foxglove/studio-base",
      "run",
      "storycap",
      "http://localhost:9001",

      ...(args.verbose ? ["--verbose"] : []),

      // Use http-server instead of start-storybook since any build errors would be raised during
      // the build above, rather than waiting several minutes for it to build inside the storycap command
      "--serverCmd",
      "yarn http-server storybook-static -p 9001",

      ...(args.local ? ["--parallel", "1"] : []),

      "--outDir",
      "storybook-screenshots",

      "--puppeteerLaunchConfig",
      JSON.stringify({
        headless: args.headless,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--user-agent=PuppeteerTestingChrome/88.",
        ],
      }),
    ]);
  }

  if (args.command.includes(Command.publish)) {
    const publishArgs: string[] = [];

    // If this is a PR, then by default github actions has us on a merge commit.
    // Checkout the feature branch and commit to make reg-suit happy.
    const prBranch = process.env.GITHUB_HEAD_REF ?? "";
    if (prBranch.length > 0) {
      await exec("git", ["fetch", "origin", prBranch]);
      await exec("git", ["checkout", "-B", prBranch, `refs/remotes/origin/${prBranch}`]);
      // Only set GitHub status checks on PR branches, not main branch
      publishArgs.push("-n");
    }

    await exec("yarn", ["workspace", "@foxglove/studio-base", "run", "reg-suit", "sync-expected"]);
    await exec("yarn", ["workspace", "@foxglove/studio-base", "run", "reg-suit", "compare"]);
    await exec("yarn", [
      "workspace",
      "@foxglove/studio-base",
      "run",
      "reg-suit",
      "publish",
      ...publishArgs,
    ]);
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
