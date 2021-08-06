// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useEffect } from "react";
import styled from "styled-components";

import Logger from "@foxglove/log";
import { Time, toDate } from "@foxglove/rostime";

import bagIcon from "../../resources/icon/BagIcon.png";
import ErrorInfo from "./ErrorInfo";
import formatByteSize from "./formatByteSize";
import { BagInfo, TopicInfo } from "./getBagInfo";

const log = Logger.getLogger(__filename);

type FileInfo = {
  name: string;
  size: number;
};

function formatTimeRaw(stamp: Time): string {
  if (stamp.sec < 0 || stamp.nsec < 0) {
    log.error("Times are not allowed to be negative");
    return "(invalid negative time)";
  }
  return `${stamp.sec}.${stamp.nsec.toFixed().padStart(9, "0")}`;
}

const SummaryRow = styled.div`
  margin: 2px 0;
  font-size: 14px;
  opacity: 0.75;
`;

const FileName = styled(SummaryRow)`
  opacity: 1;
  font-size: 18px;
  font-weight: bold;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-all;
  overflow: hidden;
`;

const TimeLabel = styled.span`
  display: inline-block;
  width: 40px;
`;

const TopicList = styled.table`
  width: 100%;
  max-width: 100%;
  word-break: break-word;
  border-spacing: 0 4px;
`;

const TopicRowWrapper = styled.tr`
  max-width: 100%;
  display: table-row;
  word-break: break-word;
  &:nth-child(2n) {
    > :first-child {
      background: rgba(0, 0, 0, 5%);
      border-radius: 4px 0 0 4px;
    }
    > :last-child {
      background: rgba(0, 0, 0, 5%);
      border-radius: 0 4px 4px 0;
    }
  }
  border-collapse: separate;
`;

const MessageCount = styled.td`
  width: 1px; /* 0 doesn't work for some reason? */
  padding: 2px 0;
  text-align: right;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  padding: 0 10px 0 4px;
  color: #888;
  vertical-align: baseline;
`;

const TopicNameAndDatatype = styled.td`
  width: 100%;
  padding: 2px 0;
  display: flex;
  flex-flow: row wrap;
  align-items: center;
  justify-content: space-between;
  padding-right: 10px;
`;

const TopicName = styled.code`
  margin-right: 10px;
`;

const Datatype = styled.div`
  font-size: 12px;
  opacity: 0.5;
`;

function TopicRow({ info: { topic, datatype, numMessages, numConnections } }: { info: TopicInfo }) {
  return (
    <TopicRowWrapper>
      <MessageCount>{numMessages.toLocaleString()}</MessageCount>
      <TopicNameAndDatatype>
        <TopicName>{topic}</TopicName>
        <Datatype>
          {datatype}
          {numConnections > 1 && ` (${numConnections})`}
        </Datatype>
      </TopicNameAndDatatype>
    </TopicRowWrapper>
  );
}

export default function BagInfoDisplay({
  fileInfo,
  bagInfo,
  error,
}: {
  fileInfo: FileInfo;
  bagInfo?: BagInfo;
  error?: Error;
}): JSX.Element {
  useEffect(() => error && console.error(error), [error]);
  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          display: "flex",
          flexFlow: "row wrap",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
        }}
      >
        <img src={bagIcon} style={{ width: 128 }} />
        <div style={{ display: "flex", flexDirection: "column", minWidth: 300, flex: "1 1 0" }}>
          <FileName>{fileInfo.name}</FileName>
          <SummaryRow>
            {bagInfo && (
              <>
                {bagInfo.topics.length.toLocaleString()}{" "}
                {bagInfo.topics.length === 1 ? "topic" : "topics"},{" "}
                {bagInfo.numChunks.toLocaleString()} {bagInfo.numChunks === 1 ? "chunk" : "chunks"},{" "}
                {bagInfo.totalMessages.toLocaleString()}{" "}
                {bagInfo.totalMessages === 1 ? "message" : "messages"},{" "}
              </>
            )}
            {formatByteSize(fileInfo.size)}
          </SummaryRow>
          {bagInfo?.startTime && (
            <SummaryRow style={{ fontVariantNumeric: "tabular-nums" }}>
              <TimeLabel>Start:</TimeLabel>
              {toDate(bagInfo.startTime).toLocaleString()} ({formatTimeRaw(bagInfo.startTime)})
            </SummaryRow>
          )}
          {bagInfo?.endTime && (
            <SummaryRow style={{ fontVariantNumeric: "tabular-nums" }}>
              <TimeLabel>End:</TimeLabel>
              {toDate(bagInfo.endTime).toLocaleString()} ({formatTimeRaw(bagInfo.endTime)})
            </SummaryRow>
          )}
        </div>
      </div>
      {error && <ErrorInfo>{error.toString()}</ErrorInfo>}
      <TopicList>
        {bagInfo?.topics.map((topicInfo, i) => (
          <TopicRow key={i} info={topicInfo} />
        ))}
      </TopicList>
    </div>
  );
}
