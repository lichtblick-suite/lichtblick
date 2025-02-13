// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// import { ErrorCircle16Filled } from "@fluentui/react-icons";
// import { CircularProgress, IconButton } from "@mui/material";
// import { useTranslation } from "react-i18next";
// import { makeStyles } from "tss-react/mui";
import { CheckOutlined, DisconnectOutlined, LoadingOutlined } from "@ant-design/icons";
// eslint-disable-next-line import/order
import { DocumentAdd24Regular, ErrorCircle20Filled } from "@fluentui/react-icons";

// import { ErrorCircle16Filled } from "@fluentui/react-icons";
import { Button } from "@mui/material";
import { Popover, Row } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import AppBarButton from "@lichtblick/suite-base/components/AppBar/AppBarButton";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@lichtblick/suite-base/components/MessagePipeline";
import { useWorkspaceActions } from "@lichtblick/suite-base/context/Workspace/useWorkspaceActions";
// import Stack from "@lichtblick/suite-base/components/Stack";
// import TextMiddleTruncate from "@lichtblick/suite-base/components/TextMiddleTruncate";
// import WssErrorModal from "@lichtblick/suite-base/components/WssErrorModal";
// import { useWorkspaceActions } from "@lichtblick/suite-base/context/Workspace/useWorkspaceActions";
import { PlayerPresence } from "@lichtblick/suite-base/players/types";

// import { CircularProgress, IconButton } from "@mui/material";
// import { useTranslation } from "react-i18next";
// import { makeStyles } from "tss-react/mui";

import { EndTimestamp } from "./EndTimestamp";

// const ICON_SIZE = 18;

// const useStyles = makeStyles<void, "adornmentError">()((theme, _params, _classes) => ({
//   sourceName: {
//     font: "inherit",
//     fontSize: theme.typography.body2.fontSize,
//     display: "flex",
//     alignItems: "center",
//     gap: theme.spacing(0.5),
//     padding: theme.spacing(1.5),
//     paddingInlineEnd: theme.spacing(0.75),
//     whiteSpace: "nowrap",
//     minWidth: 0,
//   },
//   adornment: {
//     display: "flex",
//     flex: "none",
//     alignItems: "center",
//     justifyContent: "center",
//     position: "relative",
//     color: theme.palette.appBar.primary,
//     width: ICON_SIZE,
//     height: ICON_SIZE,
//   },
//   adornmentError: {
//     color: theme.palette.error.main,
//   },
//   spinner: {
//     position: "absolute",
//     top: 0,
//     right: 0,
//     left: 0,
//     bottom: 0,
//     margin: "auto",
//   },
//   textTruncate: {
//     maxWidth: "30vw",
//     overflow: "hidden",
//   },
//   iconButton: {
//     padding: 0,
//     position: "relative",
//     zIndex: 1,
//     fontSize: ICON_SIZE - 2,

//     "svg:not(.MuiSvgIcon-root)": {
//       fontSize: "1rem",
//     },
//   },
// }));

const selectPlayerName = (ctx: MessagePipelineContext) => ctx.playerState.name;
const selectPlayerPresence = (ctx: MessagePipelineContext) => ctx.playerState.presence;
const selectPlayerProblems = (ctx: MessagePipelineContext) => ctx.playerState.problems;
const selectSeek = (ctx: MessagePipelineContext) => ctx.seekPlayback;
export const InfoContent = () => {
  const { t } = useTranslation("appBar");

  const playerName = useMessagePipeline(selectPlayerName);
  const playerPresence = useMessagePipeline(selectPlayerPresence);
  const initializing = playerPresence === PlayerPresence.INITIALIZING;
  const playerDisplayName = initializing && playerName == undefined ? "Initializing…" : playerName;
  // const playerProblems = useMessagePipeline(selectPlayerProblems) ?? [];
  const seek = useMessagePipeline(selectSeek);
  const isLiveConnection = seek == undefined;

  if (playerPresence === PlayerPresence.NOT_PRESENT) {
    return t("noDataSource");
  } else {
    return (
      <div>
        <Row>
          {playerDisplayName ?? `<${t("unknown")}>`}
          {isLiveConnection && <EndTimestamp />}
        </Row>
      </div>
    );
  }
};
export function DataSource(): React.JSX.Element {
  // const { classes, cx } = useStyles();

  const playerPresence = useMessagePipeline(selectPlayerPresence);
  const playerProblems = useMessagePipeline(selectPlayerProblems) ?? [];
  const seek = useMessagePipeline(selectSeek);
  const { dialogActions } = useWorkspaceActions();
  const { t } = useTranslation("appBar");

  // const { sidebarActions } = useWorkspaceActions();

  // A crude but correct proxy (for our current architecture) for whether a connection is live
  const isLiveConnection = seek == undefined;

  const reconnecting = playerPresence === PlayerPresence.RECONNECTING;
  const initializing = playerPresence === PlayerPresence.INITIALIZING;
  const error =
    playerPresence === PlayerPresence.ERROR ||
    playerProblems.some((problem) => problem.severity === "error");
  const loading = reconnecting || initializing;

  const [hovered, setHovered] = useState(false);

  const handleHoverChange = (open: boolean) => {
    setHovered(open);
  };

  const ICON = () => {
    // eslint-disable-next-line no-restricted-syntax
    console.log(playerPresence);
    if (isLiveConnection) {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      <CheckOutlined
        rev={undefined}
        onPointerEnterCapture={undefined}
        onPointerLeaveCapture={undefined}
      />;
    }
    if (playerPresence === PlayerPresence.PRESENT && !isLiveConnection) {
      return <DocumentAdd24Regular />;
    }
    if (playerPresence === PlayerPresence.NOT_PRESENT) {
      return (
        <DisconnectOutlined
          rev={undefined}
          onPointerEnterCapture={undefined}
          onPointerLeaveCapture={undefined}
        />
      );
    }
    if (loading || playerPresence === PlayerPresence.BUFFERING) {
      return (
        <LoadingOutlined
          rev={undefined}
          onPointerEnterCapture={undefined}
          onPointerLeaveCapture={undefined}
        />
      );
    }
    if (error) {
      return <ErrorCircle20Filled />;
    }

    return (
      <>
        {isLiveConnection && (
          <>
            <CheckOutlined
              rev={undefined}
              onPointerEnterCapture={undefined}
              onPointerLeaveCapture={undefined}
            />
            {/* <EndTimestamp /> */}
          </>
        )}
      </>
    );
  };
  return (
    <>
      {/* <Button
        style={{ boxShadow: "0 0 20px rgba(0, 0, 0, 0.3)" }}
        type="primary"
        shape="circle"
        icon={<ICON />}
        onClick={() => {
          dialogActions.dataSource.open("start");
        }}
      /> */}
      <Popover
        content={EndTimestamp}
        // content={({InfoContent})}
        trigger="hover"
        open={hovered}
        onOpenChange={handleHoverChange}
      >
        {/* <Popover
          content={
            <div>
              <InfoContent />
              <a onClick={hide}>Close</a>
            </div>
          }
          trigger="click"
          open={clicked}
          onOpenChange={handleClickChange}
        > */}
        <AppBarButton
          icon={
            <Button
              variant="contained"
              color="primary"
              // eslint-disable-next-line react/forbid-component-props
              sx={{
                borderRadius: "50%", // 设置圆形
                minWidth: "30px", // 最小宽度
                minHeight: "30px", // 最小高度
                padding: 0, // 去除默认内边距
                width: "30px", // 固定宽度
                height: "30px", // 固定高度
                boxShadow: "0 0 20px rgba(0, 0, 0, 0.3)",
              }}
            >
              <ICON />
              {/* <AddIcon /> */}
            </Button>
          }
          onClick={() => {
            dialogActions.dataSource.open("start");
          }}
          text={t("start")}
        ></AppBarButton>
      </Popover>
      {/* </Popover> */}
    </>
  );

  // if (playerPresence === PlayerPresence.NOT_PRESENT) {
  //   return <div className={classes.sourceName}>{t("noDataSource")}</div>;
  // }

  // return (
  //   <>
  //     <WssErrorModal playerProblems={playerProblems} />
  //     <Stack direction="row" alignItems="center">
  //       <div className={classes.sourceName}>
  //         <div className={classes.textTruncate}>
  //           <TextMiddleTruncate text={playerDisplayName ?? `<${t("unknown")}>`} />
  //         </div>
  //         {isLiveConnection && (
  //           <>
  //             <span>/</span>
  //             <EndTimestamp />
  //           </>
  //         )}
  //       </div>
  //       <div className={cx(classes.adornment, { [classes.adornmentError]: error })}>
  //         {loading && (
  //           <CircularProgress
  //             size={ICON_SIZE}
  //             color="inherit"
  //             className={classes.spinner}
  //             variant="indeterminate"
  //           />
  //         )}
  //         {error && (
  //           <IconButton
  //             color="inherit"
  //             className={classes.iconButton}
  //             onClick={() => {
  //               sidebarActions.left.setOpen(true);
  //               sidebarActions.left.selectItem("problems");
  //             }}
  //           >
  //             <ErrorCircle16Filled />
  //           </IconButton>
  //         )}
  //       </div>
  //     </Stack>
  //   </>
  // );
}
