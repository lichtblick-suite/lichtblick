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

import { RosObject } from "@foxglove/studio-base/players/types";
import { Marker } from "@foxglove/studio-base/types/Messages";

export type InteractionData = {
  readonly topic: string | undefined;
  readonly highlighted?: boolean;
  readonly downloader: (() => Promise<{ blob: Blob; fileName: string } | undefined>) | undefined;
  readonly originalMessage: RosObject;
  readonly instanceDetails: RosObject | undefined;
};
export type Interactive<T> = T & { interactionData: InteractionData };
export type SelectedObject = { object: Marker; instanceIndex?: number };
