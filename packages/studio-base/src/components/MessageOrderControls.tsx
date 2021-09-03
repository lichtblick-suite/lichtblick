// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { DefaultButton, DirectionalHint, useTheme } from "@fluentui/react";
import { useCallback } from "react";

import { useTooltip } from "@foxglove/studio-base/components/Tooltip";
import {
  useCurrentLayoutActions,
  useCurrentLayoutSelector,
} from "@foxglove/studio-base/context/CurrentLayoutContext";
import { defaultPlaybackConfig } from "@foxglove/studio-base/providers/CurrentLayoutProvider/reducers";
import { TimestampMethod } from "@foxglove/studio-base/util/time";

const messageOrderLabel = {
  receiveTime: "Receive time",
  headerStamp: "Header stamp",
};

export default function MessageOrderControls(): JSX.Element {
  const theme = useTheme();
  const messageOrder = useCurrentLayoutSelector(
    (state) => state.selectedLayout?.data?.playbackConfig.messageOrder ?? "receiveTime",
  );
  const { setPlaybackConfig } = useCurrentLayoutActions();

  const setMessageOrder = useCallback(
    (newMessageOrder: TimestampMethod) => {
      setPlaybackConfig({ messageOrder: newMessageOrder });
    },
    [setPlaybackConfig],
  );

  const orderText = messageOrderLabel[messageOrder] ?? defaultPlaybackConfig.messageOrder;
  const messageOrderTooltip = useTooltip({
    contents: `Order messages by ${orderText.toLowerCase()}`,
  });

  return (
    <div>
      {messageOrderTooltip.tooltip}
      <DefaultButton
        elementRef={messageOrderTooltip.ref}
        styles={{
          root: {
            background: theme.semanticColors.buttonBackgroundHovered,
            border: "none",
            margin: 0, // Remove this once global.scss has gone away
            minWidth: "100px",
            padding: theme.spacing.s1,
          },
          rootHovered: {
            background: theme.semanticColors.buttonBackgroundPressed,
          },
          label: {
            ...theme.fonts.small,
            whiteSpace: "nowrap",
          },
          menuIcon: {
            fontSize: theme.fonts.tiny.fontSize,
          },
        }}
        menuProps={{
          directionalHint: DirectionalHint.topLeftEdge,
          directionalHintFixed: true,
          gapSpace: 3,
          items: [
            {
              canCheck: true,
              key: "receiveTime",
              text: "Receive time",
              isChecked: messageOrder === "receiveTime",
              onClick: () => setMessageOrder("receiveTime"),
            },
            {
              canCheck: true,
              key: "headerStamp",
              text: "Header stamp",
              isChecked: messageOrder === "headerStamp",
              onClick: () => setMessageOrder("headerStamp"),
            },
          ],
        }}
      >
        {orderText}
      </DefaultButton>
    </div>
  );
}
