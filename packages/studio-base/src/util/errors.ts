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

import { DetailsType } from "@foxglove/studio-base/util/sendNotification";

export class AppError extends Error {
  details: DetailsType;
  extraInfo: unknown;
  override message: string;

  constructor(details: DetailsType, extraInfo?: unknown) {
    super();
    this.details = details;
    this.extraInfo = extraInfo;
    this.name = "AppError";
    this.message = "";

    if (details instanceof Error) {
      this.message = details.stack ?? details.message;
    } else if (typeof details === "string") {
      this.message = details;
    }

    if (extraInfo != undefined) {
      // If `extraInfo` was passed via a componentDidCatch:
      // https://reactjs.org/docs/react-component.html#componentdidcatch
      if ((extraInfo as { componentStack: unknown }).componentStack != undefined) {
        this.message += `\n\n${(extraInfo as { componentStack: unknown }).componentStack}`;
      } else {
        try {
          const stringifiedExtraInfo = JSON.stringify(extraInfo);
          this.message += `\n\n${stringifiedExtraInfo}`;
        } catch (e) {
          this.message += `\n\n[ Either cyclic object or object with BigInt(s) ]`;
        }
      }
    }

    if (this.message === "") {
      this.message = "Unknown Error";
    }
  }
}

export class UserError extends Error {
  details: DetailsType;

  constructor(details: DetailsType) {
    super();
    this.details = details;
    this.name = "UserError";

    if (details instanceof Error) {
      this.message = details.stack ?? details.message;
    } else if (typeof details === "string") {
      this.message = details;
    } else {
      this.message = "Unknown Error";
    }
  }
}
