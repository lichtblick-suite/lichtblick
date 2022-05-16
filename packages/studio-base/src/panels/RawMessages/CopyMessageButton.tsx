// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ClipboardOutlineIcon from "@mdi/svg/svg/clipboard-outline.svg";
import { Link } from "@mui/material";
import { useCallback, MouseEvent } from "react";

import Icon from "@foxglove/studio-base/components/Icon";
import clipboard from "@foxglove/studio-base/util/clipboard";

import { copyMessageReplacer } from "./copyMessageReplacer";

type Props = {
  text: string;
  data: unknown;
};

export default function CopyMessageButton({ text, data }: Props): JSX.Element {
  const onClick = useCallback(
    (ev: MouseEvent<HTMLElement>) => {
      ev.stopPropagation();
      ev.preventDefault();
      void clipboard.copy(JSON.stringify(data, copyMessageReplacer, 2) ?? "");
    },
    [data],
  );

  return (
    <Link color="primary" underline="none" onClick={onClick} href="#">
      <Icon tooltip="Copy entire message to clipboard" style={{ position: "relative", top: -1 }}>
        <ClipboardOutlineIcon style={{ verticalAlign: "middle" }} />
      </Icon>{" "}
      {text}
    </Link>
  );
}
