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

import { useLayoutEffect, useState } from "react";
import { useToasts, AppearanceTypes } from "react-toast-notifications";

import NotificationModal from "@foxglove/studio-base/components/NotificationModal";
import {
  DetailsType,
  NotificationType,
  setNotificationHandler,
  unsetNotificationHandler,
  NotificationSeverity,
  NotificationMessage,
} from "@foxglove/studio-base/util/sendNotification";

const severityToToastAppearance = (severity: NotificationSeverity): AppearanceTypes => {
  switch (severity) {
    case "error":
      return "error";
    case "warn":
      return "warning";
    case "info":
      return "info";
    default:
      return "info";
  }
};

export default function SendNotificationToastAdapter(): React.ReactElement {
  const { addToast } = useToasts();

  const [notificationDetails, setNotificationDetails] = useState<NotificationMessage | undefined>(
    undefined,
  );

  useLayoutEffect(() => {
    setNotificationHandler(
      (
        message: string,
        details: DetailsType,
        _type: NotificationType,
        severity: NotificationSeverity,
      ): void => {
        const onDetails = () => {
          setNotificationDetails({
            message,
            details,
            severity,
          });
        };

        addToast(
          <span>
            {message}{" "}
            <i style={{ cursor: "pointer" }} onClick={onDetails}>
              (see details)
            </i>
          </span>,
          {
            appearance: severityToToastAppearance(severity),
          },
        );
      },
    );

    return () => {
      unsetNotificationHandler();
    };
  }, [addToast]);

  return (
    <>
      {notificationDetails != undefined && (
        <NotificationModal
          notification={notificationDetails}
          onRequestClose={() => setNotificationDetails(undefined)}
        />
      )}
    </>
  );
}
