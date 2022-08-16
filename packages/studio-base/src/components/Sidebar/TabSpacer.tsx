// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/**
 * TabSpacer component fills space between <Tab> elements in a <Tabs> component
 *
 * We cannot use a <div> as a child of a Mui <Tabs> component because the <Tabs> component adds mui
 * specific properties to child elements (i.e. fullWidth, etc). This causes react console errors
 * when a <div> is used as a child since the div dom element does not have such properties.
 *
 * This component acts as a stand-in so the Tabs component can add the props and they are ignored.
 */
export function TabSpacer(): JSX.Element {
  return <div style={{ height: "100%" }} />;
}
