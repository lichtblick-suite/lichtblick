// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PropsWithChildren } from "react";

type DropdownItemProps = {
  value: unknown;
};

// DropdownItem creates an entry within a Dropdown. Use the _value_ prop to indicate
// What value the dropdown will have when the item is selected.
//
// A childless DropdownItem will render as a <span>. Specify children to customize the appearence.
export default function DropdownItem(props: PropsWithChildren<DropdownItemProps>): JSX.Element {
  if (props.children == undefined) {
    return <span>{String(props.value)}</span>;
  }

  return <>{props.children}</>;
}
