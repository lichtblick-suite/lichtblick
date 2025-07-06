// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
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
import Log from "@lichtblick/log";
const log = Log.getLogger(__filename);
export class AppError extends Error {
    details;
    extraInfo;
    message;
    constructor(details, extraInfo) {
        super();
        this.details = details;
        this.extraInfo = extraInfo;
        this.name = "AppError";
        this.message = "";
        if (details instanceof Error) {
            this.message = details.stack ?? details.message;
        }
        else if (typeof details === "string") {
            this.message = details;
        }
        if (extraInfo != undefined) {
            // If `extraInfo` was passed via a componentDidCatch:
            // https://reactjs.org/docs/react-component.html#componentdidcatch
            if (extraInfo.componentStack != undefined) {
                this.message += `\n\n${extraInfo.componentStack}`;
            }
            else {
                try {
                    const stringifiedExtraInfo = JSON.stringify(extraInfo);
                    this.message += `\n\n${stringifiedExtraInfo}`;
                }
                catch (e) {
                    log.error("Failed to stringify extraInfo", e);
                    this.message += `\n\n[ Either cyclic object or object with BigInt(s) ]`;
                }
            }
        }
        if (this.message === "") {
            this.message = "Unknown Error";
        }
    }
}
