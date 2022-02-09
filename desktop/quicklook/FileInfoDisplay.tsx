// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useEffect } from "react";
import styled from "styled-components";

import Logger from "@foxglove/log";
import { Time, toDate } from "@foxglove/rostime";

import bagIcon from "../../resources/icon/BagIcon.png";
import mcapIcon from "../../resources/icon/McapIcon.png";
import Flash from "./Flash";
import formatByteSize from "./formatByteSize";
import { FileInfo, TopicInfo } from "./types";

const log = Logger.getLogger(__filename);

type FileStats = {
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

const IconContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const FileType = styled.span`
  font-size: 10px;
  opacity: 0.25;
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
    --zebra-color: rgba(0, 0, 0, 5%);
    @media (prefers-color-scheme: dark) {
      --zebra-color: rgba(255, 255, 255, 5%);
    }
    > :first-child {
      background: var(--zebra-color);
      border-radius: 4px 0 0 4px;
    }
    > :last-child {
      background: var(--zebra-color);
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
  padding: 0 10px 0 4px;
  font-variant-numeric: tabular-nums;
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
      <MessageCount>{numMessages?.toLocaleString()}</MessageCount>
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

function formatCount(count: number | bigint | undefined, noun: string): string | undefined {
  if (count == undefined || count === 0 || count === 0n) {
    return undefined;
  }
  return `${count.toLocaleString()} ${noun}${count === 1 || count === 1n ? "" : "s"}`;
}

export default function FileInfoDisplay({
  fileStats,
  fileInfo,
  error,
}: {
  fileStats: FileStats;
  fileInfo?: FileInfo;
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
        <IconContainer>
          <img src={fileStats.name.endsWith(".mcap") ? mcapIcon : bagIcon} style={{ width: 128 }} />
          {fileInfo?.fileType && <FileType>{fileInfo.fileType}</FileType>}
        </IconContainer>
        <div style={{ display: "flex", flexDirection: "column", minWidth: 300, flex: "1 1 0" }}>
          <FileName>{fileStats.name}</FileName>
          <SummaryRow>
            {fileInfo &&
              [
                formatCount(fileInfo.topics?.length, "topic"),
                formatCount(fileInfo.numChunks, "chunk"),
                formatCount(fileInfo.totalMessages, "message"),
                formatCount(fileInfo.numAttachments, "attachment"),
                formatByteSize(fileStats.size),
              ]
                .filter(Boolean)
                .join(", ")}
          </SummaryRow>
          {fileInfo?.compressionTypes && (
            <SummaryRow>
              Compression:{" "}
              {fileInfo.compressionTypes.size === 0
                ? "none"
                : Array.from(fileInfo.compressionTypes)
                    .filter(Boolean)
                    .sort((a, b) => a.localeCompare(b))
                    .join(", ")}
            </SummaryRow>
          )}
          {fileInfo?.startTime && (
            <SummaryRow style={{ fontVariantNumeric: "tabular-nums" }}>
              <TimeLabel>Start:</TimeLabel>
              {toDate(fileInfo.startTime).toLocaleString()} ({formatTimeRaw(fileInfo.startTime)})
            </SummaryRow>
          )}
          {fileInfo?.endTime && (
            <SummaryRow style={{ fontVariantNumeric: "tabular-nums" }}>
              <TimeLabel>End:</TimeLabel>
              {toDate(fileInfo.endTime).toLocaleString()} ({formatTimeRaw(fileInfo.endTime)})
            </SummaryRow>
          )}
        </div>
      </div>
      {error && <Flash type="error">{error.toString()}</Flash>}
      <TopicList>
        <tbody>
          {fileInfo?.topics?.map((topicInfo, i) => (
            <TopicRow key={i} info={topicInfo} />
          ))}
        </tbody>
      </TopicList>
    </div>
  );
}
