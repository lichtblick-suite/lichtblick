// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { panel } from "@foxglove/studio";

export default function HelloWorldPanel(): JSX.Element {
  const [config] = panel.useConfig();

  return (
    <>
      <div>Hello World!</div>
      <div>{JSON.stringify(config)}</div>
    </>
  );
}
