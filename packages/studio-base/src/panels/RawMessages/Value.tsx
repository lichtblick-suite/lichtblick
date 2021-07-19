// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ConsoleLineIcon from "@mdi/svg/svg/console-line.svg";

import Icon from "@foxglove/studio-base/components/Icon";
import { PanelConfig } from "@foxglove/studio-base/types/panels";

import HighlightedValue from "./HighlightedValue";
import RawMessagesIcons from "./RawMessagesIcons";
import { ValueAction } from "./getValueActionForValue";
import styles from "./index.module.scss";

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
  openSiblingPanel: (type: string, cb: (config: PanelConfig) => PanelConfig) => void;
}): JSX.Element {
  return (
    <span>
      <HighlightedValue itemLabel={itemLabel} />
      {arrLabel.length !== 0 && (
        <>
          {arrLabel}
          <Icon
            fade
            className={styles.icon ?? ""}
            // eslint-disable-next-line no-restricted-syntax
            onClick={() => console.log(itemValue)}
            tooltip="Log data to browser console"
          >
            <ConsoleLineIcon />
          </Icon>
        </>
      )}
      <span className={styles.iconBox ?? ""}>
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
