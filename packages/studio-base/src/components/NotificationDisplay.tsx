// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import WarnIcon from "@mdi/svg/svg/alert.svg";
import InfoIcon from "@mdi/svg/svg/bell.svg";
import NotificationIcon from "@mdi/svg/svg/close-circle.svg";
import moment from "moment";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import styled from "styled-components";
import tinyColor from "tinycolor2";
import { v4 as uuidv4 } from "uuid";

import ChildToggle from "@foxglove/studio-base/components/ChildToggle";
import Icon from "@foxglove/studio-base/components/Icon";
import Menu from "@foxglove/studio-base/components/Menu";
import NotificationModal from "@foxglove/studio-base/components/NotificationModal";
import {
  DetailsType,
  NotificationMessage,
  NotificationType,
  setNotificationHandler,
  unsetNotificationHandler,
  NotificationSeverity,
} from "@foxglove/studio-base/util/sendNotification";
import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";

const Container = styled.div<{ flash: boolean; unread: boolean; color: string }>`
  height: 100%;
  display: flex;
  flex: 1 1 auto;
  justify-content: flex-end;
  align-items: center;
  padding: 0px 8px;
  transition: background-color 200ms linear;
  background-color: ${(props) =>
    props.flash ? tinyColor(props.color).darken(0).toRgbString() : "none"};
  color: ${(props) =>
    props.flash ? "black" : props.unread ? props.color : "rgba(255, 255, 255, 0.5)"};
`;

const Fader = styled.span`
  text-align: center;
  font-size: 12px;
  padding-right: 2px;
  transition: opacity 200ms linear;
  display: inline-block;
  max-width: 500px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const FLASH_DURATION_MILLIS = 1000;

const SItemContainer = styled.div`
  color: ${(props) => props.color};
  cursor: pointer;
  display: flex;
  flex-direction: row;
  padding: 8px;
  min-width: 280px;
  max-width: 500px;
  font-size: 15px;
  &:hover {
    background-color: rgba(0, 0, 0, 0.2);
  }
`;

const SText = styled.div`
  flex: 1 1 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  line-height: 14px;
`;

const STime = styled.div`
  color: ${colors.TEXT_MUTED};
  font-size: 11px;
  display: flex;
  flex: 0 0 24px;
  align-items: center;
  justify-content: flex-end;
`;

type NotificationItemProps = {
  notification: NotificationMessage;
  onClick: () => void;
};

const displayPropsBySeverity = {
  error: {
    color: colors.RED1,
    name: "Errors",
    IconSvg: NotificationIcon,
  },
  warn: {
    color: colors.YELLOW1,
    name: "Warnings",
    IconSvg: WarnIcon,
  },
  info: {
    color: colors.BLUEL1,
    name: "Messages",
    IconSvg: InfoIcon,
  },
};
const getColorForSeverity = (severity: NotificationSeverity): string =>
  displayPropsBySeverity[severity].color ?? colors.BLUEL1;

function NotificationItem(props: NotificationItemProps) {
  const { notification, onClick } = props;
  const color = getColorForSeverity(notification.severity);
  const duration = moment.duration(moment().diff(moment(notification.created)));
  const seconds = duration.asSeconds();
  let timeString = "";
  if (seconds < 60) {
    timeString = `${Math.round(seconds)}s`;
  } else if (seconds < 3600) {
    timeString = `${Math.round(seconds / 60)}m`;
  } else {
    timeString = `${Math.round(seconds / 3600)}h`;
  }
  return (
    <SItemContainer onClick={onClick} color={color}>
      <SText className="notification-message">{notification.message}</SText>
      {notification.read === false && <div style={{ paddingRight: 8 }}>•</div>}
      <STime>{timeString}</STime>
    </SItemContainer>
  );
}

type NotificationListProps = {
  notifications: NotificationMessage[];
  onClick: (err: NotificationMessage) => void;
};

// exported for storybook
export class NotificationList extends React.PureComponent<NotificationListProps> {
  override render(): JSX.Element {
    const { notifications, onClick } = this.props;
    return (
      <Menu style={{ marginTop: 2 }}>
        {notifications.map((er) => (
          <NotificationItem key={er.id} notification={er} onClick={() => onClick(er)} />
        ))}
      </Menu>
    );
  }
}

export default function NotificationDisplay(): React.ReactElement {
  const [notifications, setNotifications] = useState<NotificationMessage[]>([]);
  const [showMostRecent, setShowMostRecent] = useState(false);
  const [clickedNotification, setClickedNotification] = useState<NotificationMessage>();
  const hideTimeout = useRef<ReturnType<typeof setTimeout>>();

  useLayoutEffect(() => {
    setNotificationHandler(
      (
        message: string,
        details: DetailsType,
        _type: NotificationType,
        severity: NotificationSeverity,
      ): void => {
        // shift notifications in to the front of the array and keep a max of 100
        setNotifications((notes) => [
          { id: uuidv4(), created: new Date(), read: false, message, details, severity },
          ...notes.slice(0, 100),
        ]);
        setShowMostRecent(true);

        if (hideTimeout.current) {
          clearTimeout(hideTimeout.current);
        }
        hideTimeout.current = setTimeout(() => {
          setShowMostRecent(false);
        }, FLASH_DURATION_MILLIS);
      },
    );

    return () => {
      if (hideTimeout.current) {
        clearTimeout(hideTimeout.current);
      }
      unsetNotificationHandler();
    };
  }, []);

  const toggleNotificationList = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      // mark items read on closed
      setNotifications((notes) => notes.map((note) => ({ ...note, read: true })));
    }
  }, []);

  const unreadCount = notifications.reduce((acc, err) => acc + (err.read === true ? 0 : 1), 0);

  const firstNotification = notifications[0];
  const { name, color, IconSvg } = displayPropsBySeverity[firstNotification?.severity ?? "error"];
  const hasUnread = unreadCount > 0;

  return (
    <Container flash={showMostRecent} unread={hasUnread} color={color}>
      {clickedNotification && (
        <NotificationModal
          notification={clickedNotification}
          onRequestClose={() => setClickedNotification(undefined)}
        />
      )}
      {firstNotification && (
        <ChildToggle position="below" onToggle={toggleNotificationList}>
          <div style={{ display: "flex", flex: "1 1 auto", alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                flex: "none",
                alignItems: "center",
                whiteSpace: "nowrap",
              }}
            >
              <Icon small tooltip={name}>
                <IconSvg />
              </Icon>
            </div>
            <Fader style={{ paddingLeft: 5, cursor: "pointer" }}>{firstNotification.message}</Fader>
            <div style={{ fontSize: 12 }}>{unreadCount > 1 && ` (1 of ${unreadCount})`}</div>
          </div>
          <NotificationList notifications={notifications} onClick={setClickedNotification} />
        </ChildToggle>
      )}
    </Container>
  );
}
