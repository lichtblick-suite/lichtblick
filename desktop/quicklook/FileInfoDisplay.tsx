// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useEffect, useMemo } from "react";
import { makeStyles } from "tss-react/mui";

import Logger from "@foxglove/log";
import { Time, toDate } from "@foxglove/rostime";

import bagIcon from "../../resources/icon/BagIcon.png";
import mcapIcon from "../../resources/icon/McapIcon.png";
import Flash from "./Flash";
import formatByteSize from "./formatByteSize";
import { BODY_PADDING, NARROW_MAX_WIDTH, NARROW_MIN_WIDTH } from "./styleConstants";
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

const useStyles = makeStyles()(() => ({
  root: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  details: {
    display: "flex",
    flexDirection: "column",
    flex: "1 1 0",
  },
  summaryRow: {
    margin: "2px 0",
    fontSize: "14px",
    opacity: 0.75,
  },
  fileName: {
    opacity: 1,
    fontSize: "18px",
    fontWeight: "bold",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    wordBreak: "break-all",
    overflow: "hidden",
  },
  iconContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",

    [`@media (max-width: ${NARROW_MAX_WIDTH}px)`]: {
      display: "none",
    },
  },
  fileType: {
    fontSize: "10px",
    opacity: 0.25,
  },
  timeLabel: {
    display: "inline-block",
    width: 40,
  },
  topicList: {
    wordBreak: "break-word",
    borderSpacing: "0 4px",

    [`@media (max-width: ${NARROW_MAX_WIDTH}px)`]: {
      marginLeft: -BODY_PADDING,
      marginRight: -BODY_PADDING,
    },
  },
  topicRowWrapper: {
    maxWidth: "100%",
    display: "table-row",
    wordBreak: "break-word",
    borderCollapse: "separate",

    "&:nth-child(2n)": {
      "--zebra-color": "rgba(0, 0, 0, 5%)",

      "@media (prefers-color-scheme: dark)": {
        "--zebra-color": "rgba(255, 255, 255, 5%)",
      },
      "& > :first-of-type": {
        background: "var(--zebra-color)",

        [`@media (min-width: ${NARROW_MIN_WIDTH}px)`]: {
          borderRadius: "4px 0 0 4px",
        },
      },
      "& > :last-child": {
        background: "var(--zebra-color)",

        [`@media (min-width: ${NARROW_MIN_WIDTH}px)`]: {
          borderRadius: "0 4px 4px 0",
        },
      },
    },
  },
  messageCount: {
    width: 1, // 0 doesn't work for some reason?
    textAlign: "right",
    whiteSpace: "nowrap",
    padding: "0 10px 0 4px",
    fontVariantNumeric: "tabular-nums",
    color: "#888",
    verticalAlign: "baseline",
  },
  topicNameAndDatatype: {
    width: "100%",
    padding: "2px 0",
    display: "flex",
    flexFlow: "row wrap",
    alignItems: "center",
    justifyContent: "space-between",
    paddingRight: 10,
  },
  topicName: {
    marginRight: 10,
  },
  datatype: {
    fontSize: "12px",
    opacity: 0.5,
  },
  hideNarrow: {
    [`@media (max-width: ${NARROW_MAX_WIDTH}px)`]: {
      display: "none",
    },
  },
  showNarrow: {
    [`@media (min-width: ${NARROW_MIN_WIDTH}px)`]: {
      display: "none",
    },
  },
}));

function formatCount(count: number | bigint | undefined, noun: string): string | undefined {
  if (count == undefined || count === 0 || count === 0n) {
    return undefined;
  }
  return `${count.toLocaleString()}\xa0${noun}${count === 1 || count === 1n ? "" : "s"}`;
}

function TopicRow(props: { info: TopicInfo }) {
  const {
    info: { topic, datatype, numMessages, numConnections },
  } = props;
  const { classes } = useStyles();

  return (
    <tr className={classes.topicRowWrapper}>
      <td className={classes.messageCount}>{numMessages?.toLocaleString()}</td>
      <td className={classes.topicNameAndDatatype}>
        <code className={classes.topicName}>{topic}</code>
        <div className={classes.datatype}>
          {datatype}
          {numConnections > 1 && ` (${numConnections})`}
        </div>
      </td>
    </tr>
  );
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
  const { classes } = useStyles();
  const compressionTypes = useMemo(
    () =>
      fileInfo?.compressionTypes &&
      Array.from(fileInfo.compressionTypes)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    [fileInfo?.compressionTypes],
  );
  useEffect(() => error && console.error(error), [error]);
  return (
    <div className={classes.root}>
      <header className={classes.header}>
        <div className={classes.iconContainer}>
          <img src={fileStats.name.endsWith(".mcap") ? mcapIcon : bagIcon} style={{ width: 128 }} />
          {fileInfo?.fileType && (
            <div className={classes.hideNarrow}>
              <span className={classes.fileType}>{fileInfo.fileType}</span>
            </div>
          )}
        </div>
        <div className={classes.details}>
          <div className={classes.hideNarrow}>
            <span className={classes.fileName}>{fileStats.name}</span>
          </div>
          {fileInfo?.fileType && (
            <div className={classes.showNarrow}>
              <span className={classes.fileType}>{fileInfo.fileType}</span>
            </div>
          )}
          <div className={classes.summaryRow}>
            {[
              formatCount(fileInfo?.topics?.length, "topic"),
              formatCount(fileInfo?.numChunks, "chunk"),
              formatCount(fileInfo?.totalMessages, "message"),
              formatCount(fileInfo?.numAttachments, "attachment"),
              formatByteSize(fileStats.size).replace(/ /g, "\xa0"),
            ]
              .filter(Boolean)
              .join(", ")}
          </div>
          {compressionTypes && (
            <div className={classes.summaryRow}>
              Compression: {compressionTypes.length === 0 ? "none" : compressionTypes.join(", ")}
            </div>
          )}
          {fileInfo?.startTime && (
            <div className={classes.summaryRow} style={{ fontVariantNumeric: "tabular-nums" }}>
              <span className={classes.timeLabel}>Start:</span>
              {toDate(fileInfo.startTime).toLocaleString()} ({formatTimeRaw(fileInfo.startTime)})
            </div>
          )}
          {fileInfo?.endTime && (
            <div className={classes.summaryRow} style={{ fontVariantNumeric: "tabular-nums" }}>
              <span className={classes.timeLabel}>End:</span>
              {toDate(fileInfo.endTime).toLocaleString()} ({formatTimeRaw(fileInfo.endTime)})
            </div>
          )}
        </div>
      </header>
      {error && <Flash color="error">{error.toString()}</Flash>}
      <table className={classes.topicList}>
        <tbody>
          {fileInfo?.topics?.map((topicInfo, i) => (
            <TopicRow key={i} info={topicInfo} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
