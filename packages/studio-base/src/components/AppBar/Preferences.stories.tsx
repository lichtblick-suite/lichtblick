// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PreferencesDialog } from "@foxglove/studio-base/components/AppBar/Preferences";

export default {
  title: "components/PreferencesDialog",
  component: PreferencesDialog,
};

export function Default(): JSX.Element {
  return <PreferencesDialog open />;
}
Default.parameters = { colorScheme: "light" };

export function General(): JSX.Element {
  return <PreferencesDialog open activeTab="general" />;
}
General.parameters = { colorScheme: "light" };

export function Privacy(): JSX.Element {
  return <PreferencesDialog open activeTab="privacy" />;
}
Privacy.parameters = { colorScheme: "light" };

export function Experimental(): JSX.Element {
  return <PreferencesDialog open activeTab="lab" />;
}
Experimental.parameters = { colorScheme: "light" };

export function About(): JSX.Element {
  return <PreferencesDialog open activeTab="about" />;
}
About.parameters = { colorScheme: "light" };
