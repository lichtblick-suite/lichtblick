// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

// Entrypoint for chartjs worker

import Rpc, { Channel } from "@foxglove/studio-base/util/Rpc";
import { inWebWorker } from "@foxglove/studio-base/util/workers";

import ChartJsMux from "./ChartJsMux";

if (inWebWorker()) {
  // Since we use a single _web_ target for our bundle, _global_ referrs to the window global
  // rather than WorkerGlobalScope. We cast to the value we know it actually is.
  // #FG-64
  new ChartJsMux(new Rpc(global as unknown as Channel));
}
