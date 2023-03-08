// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import VersionBanner from "./VersionBanner";

export default {
  title: "web/VersionBanner",
  component: VersionBanner,
};

export function OldChrome(): JSX.Element {
  return <VersionBanner isChrome currentVersion={42} isDismissable />;
}

export function UnsupportedBrowser(): JSX.Element {
  return <VersionBanner isChrome={false} currentVersion={42} isDismissable />;
}
