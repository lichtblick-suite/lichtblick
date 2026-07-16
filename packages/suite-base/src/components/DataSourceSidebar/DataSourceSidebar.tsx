// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import AddIcon from "@mui/icons-material/Add";
import { CircularProgress, Divider, IconButton } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { AppSetting } from "@lichtblick/suite-base/AppSetting";
import { EventsList } from "@lichtblick/suite-base/components/EventsList";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@lichtblick/suite-base/components/MessagePipeline";
import { SidebarContent } from "@lichtblick/suite-base/components/SidebarContent";
import Stack from "@lichtblick/suite-base/components/Stack";
import { TopicList } from "@lichtblick/suite-base/components/TopicList";
import WssErrorModal from "@lichtblick/suite-base/components/WssErrorModal";
import { useCurrentUser } from "@lichtblick/suite-base/context/CurrentUserContext";
import { EventsStore, useEvents } from "@lichtblick/suite-base/context/EventsContext";
import { useWorkspaceActions } from "@lichtblick/suite-base/context/Workspace/useWorkspaceActions";
import useAlertCount from "@lichtblick/suite-base/hooks/useAlertCount";
import { useAppConfigurationValue } from "@lichtblick/suite-base/hooks/useAppConfigurationValue";
import { PlayerPresence } from "@lichtblick/suite-base/players/types";

import { AlertsList } from "../AlertList/AlertsList";
import { DataSourceInfoView } from "../DataSourceInfoView";
import { StyledTab, StyledTabs, useStyles } from "./DataSourceSidebar.style";
import { AlertBadge } from "./utils";

type Props = {
  disableToolbar?: boolean;
};

const selectPlayerPresence = ({ playerState }: MessagePipelineContext) => playerState.presence;
const selectSelectedEventId = (store: EventsStore) => store.selectedEventId;
const selectEventsSupported = (store: EventsStore) => store.eventsSupported;

type DataSourceSidebarTab = "topics" | "events" | "alerts";

export default function DataSourceSidebar(props: Props): React.JSX.Element {
  const { disableToolbar = false } = props;
  const playerPresence = useMessagePipeline(selectPlayerPresence);
  const { playerAlerts, alertCount, highestSeverity } = useAlertCount();
  const { currentUser } = useCurrentUser();
  const selectedEventId = useEvents(selectSelectedEventId);
  const [activeTab, setActiveTab] = useState<DataSourceSidebarTab>("topics");
  const { classes } = useStyles();
  const { t } = useTranslation("dataSourceInfo");
  const { dialogActions } = useWorkspaceActions();

  const [enableNewTopNav = true] = useAppConfigurationValue<boolean>(AppSetting.ENABLE_NEW_TOPNAV);

  const eventsSupported = useEvents(selectEventsSupported);
  const showEventsTab = !enableNewTopNav && currentUser != undefined && eventsSupported;

  const isLoading = useMemo(
    () =>
      playerPresence === PlayerPresence.INITIALIZING ||
      playerPresence === PlayerPresence.RECONNECTING,
    [playerPresence],
  );

  useEffect(() => {
    if (playerPresence === PlayerPresence.ERROR || playerPresence === PlayerPresence.RECONNECTING) {
      setActiveTab("alerts");
    } else if (showEventsTab && selectedEventId != undefined) {
      setActiveTab("events");
    }
  }, [playerPresence, showEventsTab, selectedEventId]);

  return (
    <SidebarContent
      disablePadding
      disableToolbar={disableToolbar}
      overflow="auto"
      title={t("dataSource")}
      trailingItems={[
        isLoading && (
          <Stack key="loading" alignItems="center" justifyContent="center" padding={1}>
            <CircularProgress size={18} variant="indeterminate" />
          </Stack>
        ),
        <IconButton
          key="add-connection"
          color="primary"
          title="New connection"
          onClick={() => {
            dialogActions.dataSource.open("start");
          }}
        >
          <AddIcon />
        </IconButton>,
      ].filter(Boolean)}
    >
      <Stack fullHeight>
        {!disableToolbar && (
          <Stack paddingX={2} paddingBottom={2}>
            <DataSourceInfoView />
          </Stack>
        )}
        {playerPresence !== PlayerPresence.NOT_PRESENT && (
          <>
            <Stack flex={1}>
              {!disableToolbar && (
                <>
                  <StyledTabs
                    value={activeTab}
                    onChange={(_ev, newValue: DataSourceSidebarTab) => {
                      setActiveTab(newValue);
                    }}
                    textColor="inherit"
                  >
                    <StyledTab disableRipple label="Topics" value="topics" />
                    {showEventsTab && <StyledTab disableRipple label="Events" value="events" />}
                    <StyledTab
                      disableRipple
                      label={
                        <Stack direction="row" alignItems="baseline" gap={1}>
                          Alerts
                          {alertCount > 0 && (
                            <AlertBadge count={alertCount} severity={highestSeverity} />
                          )}
                        </Stack>
                      }
                      value="alerts"
                    />
                  </StyledTabs>
                  <Divider />
                </>
              )}
              {activeTab === "topics" && (
                <div className={classes.tabContent}>
                  <TopicList />
                </div>
              )}
              {activeTab === "events" && (
                <div className={classes.tabContent}>
                  <EventsList />
                </div>
              )}
              {activeTab === "alerts" && (
                <div className={classes.tabContent}>
                  <AlertsList />
                </div>
              )}
            </Stack>
          </>
        )}
      </Stack>
      <WssErrorModal playerAlerts={playerAlerts} />
    </SidebarContent>
  );
}
