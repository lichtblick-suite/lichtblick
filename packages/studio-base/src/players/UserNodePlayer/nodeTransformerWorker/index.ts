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
import generateRosLib from "@foxglove/studio-base/players/UserNodePlayer/nodeTransformerWorker/generateRosLib";
import transform from "@foxglove/studio-base/players/UserNodePlayer/nodeTransformerWorker/transform";
import Rpc from "@foxglove/studio-base/util/Rpc";
import { setupSendReportNotificationHandler } from "@foxglove/studio-base/util/RpcWorkerUtils";
import { enforceFetchIsBlocked, inSharedWorker } from "@foxglove/studio-base/util/workers";

let unsentErrors: string[] = [];
(global as unknown as SharedWorkerGlobalScope).onerror = (event: ErrorEvent) => {
  unsentErrors.push((event.error as Error).toString());
};
(global as unknown as SharedWorkerGlobalScope).onunhandledrejection = (
  event: PromiseRejectionEvent,
) => {
  unsentErrors.push(String(event.reason instanceof Error ? event.reason.message : event.reason));
};

if (!inSharedWorker()) {
  // In Chrome, web workers currently (as of March 2020) inherit their Content Security Policy from
  // their associated page, ignoring any policy in the headers of their source file. SharedWorkers
  // use the headers from their source files, though, and we use a CSP to prohibit user scripts
  // workers from making web requests (using enforceFetchIsBlocked, below.)
  // https://bugs.chromium.org/p/chromium/issues/detail?id=1012640
  throw new Error("Not in a SharedWorker.");
}

(global as unknown as SharedWorkerGlobalScope).onconnect = (connectEvent: MessageEvent) => {
  const port = connectEvent.ports[0];
  if (!port) {
    throw new Error("NodeTransformWorker connect requires at least 1 message port.");
  }

  const rpc = new Rpc(port);

  // If any errors occurred while nobody was connected, send them now
  unsentErrors.forEach(async (message) => {
    await rpc.send("error", message);
  });
  unsentErrors = [];
  (global as unknown as SharedWorkerGlobalScope).onerror = (event: ErrorEvent) => {
    void rpc.send("error", event.error.toString());
  };
  (global as unknown as SharedWorkerGlobalScope).onunhandledrejection = (
    event: PromiseRejectionEvent,
  ) => {
    void rpc.send(
      "error",
      String(event.reason instanceof Error ? event.reason.message : event.reason),
    );
  };

  setupSendReportNotificationHandler(rpc);
  // Shared workers need to be closed "from the inside" -- they have no terminate() method.
  rpc.receive("close", () => {
    global.close();
  });
  rpc.receive("transform", enforceFetchIsBlocked(transform));
  rpc.receive("generateRosLib", generateRosLib);
  port.start();
};
