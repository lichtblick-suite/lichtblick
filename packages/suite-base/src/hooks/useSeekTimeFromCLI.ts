// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { enqueueSnackbar } from "notistack";
import { useEffect } from "react";

import { useMessagePipelineGetter } from "@lichtblick/suite-base/components/MessagePipeline";
import { useAppParameters } from "@lichtblick/suite-base/context/AppParametersContext";
import { PlayerPresence } from "@lichtblick/suite-base/players/types";
import { parseTimestampStr } from "@lichtblick/suite-base/util/parseMultipleTimes";

const useSeekTimeFromCLI = (): void => {
  const {
    playerState: { presence },
    seekPlayback,
  } = useMessagePipelineGetter()();

  const { time } = useAppParameters();

  useEffect(() => {
    if (!time || !seekPlayback) {
      return;
    }

    // Wait until player is ready before we try to seek.
    if (presence !== PlayerPresence.PRESENT) {
      return;
    }

    const parsedTime = parseTimestampStr(time);

    if (parsedTime == undefined) {
      // Show an error message to the user indicating that the time format is invalid
      enqueueSnackbar(
        "Invalid time format using 'time' parameter on CLI. Please check and try again.",
        { variant: "warning" },
      );
      return;
    }

    seekPlayback(parsedTime);
  }, [time, seekPlayback, presence]);
};

export default useSeekTimeFromCLI;
