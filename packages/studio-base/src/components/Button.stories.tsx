// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { storiesOf } from "@storybook/react";

import Button from "@foxglove/studio-base/components/Button";

storiesOf("components/Button", module)
  .add("default", () => {
    return <Button>Some Button</Button>;
  })
  .add("onClick", () => {
    return <Button onClick={() => alert("cool click")}>Click me!</Button>;
  })
  .add("primary", () => {
    return <Button primary>Primary</Button>;
  })
  .add("isPrimary", () => {
    return <Button isPrimary>isPrimary</Button>;
  })
  .add("warning", () => {
    return <Button warning>Warning</Button>;
  })
  .add("danger", () => {
    return <Button danger>Dangertown</Button>;
  })
  .add("disabled", () => {
    return (
      <Button disabled={true} onClick={() => alert("cool click")}>
        Disabled
      </Button>
    );
  })
  .add("tooltip", () => {
    return <Button tooltip={"Wahoo"}>Some Button</Button>;
  });
