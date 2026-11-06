// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Button } from "@mui/material";

import { quoteTopicNameIfNeeded } from "@lichtblick/message-path";
import { Channel } from "@lichtblick/suite";
import useAddPanel from "@lichtblick/suite-base/hooks/useAddPanel";

export function InspectChannelButton({ channel }: { channel: Channel }): React.JSX.Element {
  const addPanel = useAddPanel();
  return (
    <Button
      size="small"
      onMouseDown={(event) => {
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.stopPropagation();
        addPanel({
          type: "RawMessagesVirtual",
          config: { topicPath: quoteTopicNameIfNeeded(channel.topic), channelId: channel.id },
        });
      }}
    >
      Inspect
    </Button>
  );
}
