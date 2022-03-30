// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { exec } from "@actions/exec";
import { log } from "builder-util";
import type { WindowsSignOptions } from "electron-builder";
import { copyFile, mkdtemp } from "fs/promises";
import * as os from "os";
import * as path from "path";

exports.default = async function (context: WindowsSignOptions) {
  const USER_NAME = process.env.WINDOWS_SIGN_USER_NAME;
  const USER_PASSWORD = process.env.WINDOWS_SIGN_USER_PASSWORD;
  const CREDENTIAL_ID = process.env.WINDOWS_SIGN_CREDENTIAL_ID;
  const USER_TOTP = process.env.WINDOWS_SIGN_USER_TOTP;

  // skip signing temp paths like dist/__uninstaller-nsis-foxglove-studio.exe and -unpacked
  if (context.path.includes("-unpacked") || context.path.includes("__uninstaller")) {
    return;
  }

  if (!USER_NAME || !USER_PASSWORD || !CREDENTIAL_ID || !USER_TOTP) {
    log.info("Skipping signing");
    return;
  }

  const { base } = path.parse(context.path);

  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "signing-"));
  const tmpPath = path.join(tmpDir, base);

  log.info(`Signing: ${context.path}`);
  await exec(
    "./CodeSignTool.bat",
    [
      "sign",
      "-input_file_path",
      context.path,
      "-output_dir_path",
      tmpDir,
      "-credential_id",
      CREDENTIAL_ID,
      "-username",
      USER_NAME,
      "-password",
      USER_PASSWORD,
      "-totp_secret",
      USER_TOTP,
    ],
    {
      cwd: "./CodeSignTool",
    },
  );

  // Copy the file because src and dest might be on different devices
  // "rename" does not work across devices
  log.info(`Copy: ${tmpPath} -> ${context.path}`);
  await copyFile(tmpPath, context.path);
};
