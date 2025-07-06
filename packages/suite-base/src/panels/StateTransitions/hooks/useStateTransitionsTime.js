// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { useMemo } from "react";
import { toSec } from "@lichtblick/rostime";
import { useMessagePipelineGetter } from "@lichtblick/suite-base/components/MessagePipeline";
import { subtractTimes } from "@lichtblick/suite-base/players/UserScriptPlayer/transformerWorker/typescript/userUtils/time";
const useStateTransitionsTime = () => {
    const getMessagePipelineState = useMessagePipelineGetter();
    const { playerState: { activeData: { startTime, currentTime, endTime } = {} }, } = getMessagePipelineState();
    const currentTimeSinceStart = useMemo(() => (currentTime && startTime ? toSec(subtractTimes(currentTime, startTime)) : undefined), [currentTime, startTime]);
    const endTimeSinceStart = useMemo(() => (endTime && startTime ? toSec(subtractTimes(endTime, startTime)) : undefined), [endTime, startTime]);
    return { startTime, currentTimeSinceStart, endTimeSinceStart };
};
export default useStateTransitionsTime;
