// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useAsync } from "react-use";

import Logger from "@foxglove/log";
import { useMessagePipeline } from "@foxglove/studio-base/components/MessagePipeline";
import { useConsoleApi } from "@foxglove/studio-base/context/ConsoleApiContext";
import { useCurrentUser } from "@foxglove/studio-base/context/CurrentUserContext";
import { useEvents } from "@foxglove/studio-base/context/EventsContext";

const log = Logger.getLogger(__filename);

export function EventsSyncAdapter(): ReactNull {
  const { currentUser } = useCurrentUser();
  const urlState = useMessagePipeline((s) => s.playerState.urlState);
  const consoleApi = useConsoleApi();
  const setEvents = useEvents((store) => store.setEvents);

  useAsync(async () => {
    if (
      currentUser &&
      urlState?.sourceId === "foxglove-data-platform" &&
      urlState.parameters != undefined
    ) {
      const queryParams = urlState.parameters as { deviceId: string; start: string; end: string };
      setEvents({ loading: true });
      try {
        const events = await consoleApi.getEvents(queryParams);
        setEvents({ loading: false, value: events });
      } catch (error) {
        log.error(error);
        setEvents({ loading: false, error });
      }
    } else {
      setEvents({ loading: false });
    }
  }, [consoleApi, currentUser, setEvents, urlState?.parameters, urlState?.sourceId]);

  return ReactNull;
}
