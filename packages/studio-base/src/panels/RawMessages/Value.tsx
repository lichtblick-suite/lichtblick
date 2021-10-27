// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { mergeStyleSets } from "@fluentui/react";
import ClipboardOutlineIcon from "@mdi/svg/svg/clipboard-outline.svg";

import Icon from "@foxglove/studio-base/components/Icon";
import { OpenSiblingPanel } from "@foxglove/studio-base/types/panels";
import clipboard from "@foxglove/studio-base/util/clipboard";

import HighlightedValue from "./HighlightedValue";
import RawMessagesIcons from "./RawMessagesIcons";
import { copyMessageReplacer } from "./copyMessageReplacer";
import { ValueAction } from "./getValueActionForValue";

const classes = mergeStyleSets({
  icon: {
    "> svg": {
      verticalAlign: "top !important",
    },
  },
  iconBox: {
    display: "inline-block",
    whiteSpace: "nowrap",
    width: "0px",
    height: "0px",
    position: "relative",
    left: "6px",
  },
});

export default function Value({
  arrLabel,
  basePath,
  itemLabel,
  itemValue,
  valueAction,
  onTopicPathChange,
  openSiblingPanel,
}: {
  arrLabel: string;
  basePath: string;
  itemLabel: string;
  itemValue: unknown;
  valueAction: ValueAction | undefined;
  onTopicPathChange: (arg0: string) => void;
  openSiblingPanel: OpenSiblingPanel;
}): JSX.Element {
  return (
    <span>
      <HighlightedValue itemLabel={itemLabel} />
      {arrLabel.length !== 0 && (
        <>
          {arrLabel}
          <Icon
            fade
            className={classes.icon}
            onClick={() => {
              void clipboard.copy(JSON.stringify(itemValue, copyMessageReplacer, 2) ?? "");
            }}
            tooltip="Copy"
          >
            <ClipboardOutlineIcon />
          </Icon>
        </>
      )}
      <span className={classes.iconBox}>
        {valueAction != undefined ? (
          <RawMessagesIcons
            valueAction={valueAction}
            basePath={basePath}
            onTopicPathChange={onTopicPathChange}
            openSiblingPanel={openSiblingPanel}
          />
        ) : undefined}
      </span>
    </span>
  );
}
