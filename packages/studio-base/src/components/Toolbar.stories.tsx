// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import Toolbar from "@foxglove/studio-base/components/Toolbar";

export default {
  title: "components/Toolbar",
  component: Toolbar,
};

export function Default(): JSX.Element {
  return (
    <div style={{ width: 400 }}>
      <Toolbar>
        <span style={{ flexGrow: 1 }}>Hello</span>
        <span>There</span>
      </Toolbar>
    </div>
  );
}
