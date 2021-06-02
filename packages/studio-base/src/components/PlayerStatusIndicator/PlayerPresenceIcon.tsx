// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import AlertIcon from "@mdi/svg/svg/alert.svg";

import Icon from "@foxglove/studio-base/components/Icon";
import SpinningLoadingIcon from "@foxglove/studio-base/components/SpinningLoadingIcon";
import { PlayerPresence, PlayerState } from "@foxglove/studio-base/players/types";
import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";

type Props = {
  presence: PlayerState["presence"];
  hasProblems?: boolean;
};

export function PlayerPrecenceIcon(props: Props): JSX.Element | ReactNull {
  const { presence: playerPresence } = props;

  switch (playerPresence) {
    case PlayerPresence.NOT_PRESENT:
    case PlayerPresence.PRESENT:
      // if there are problems - render an icon
      if (props.hasProblems === true) {
        return (
          <Icon style={{ color: colors.RED1 }}>
            <AlertIcon />
          </Icon>
        );
      }
      break;
    case PlayerPresence.CONSTRUCTING:
    case PlayerPresence.INITIALIZING:
    case PlayerPresence.RECONNECTING:
      return (
        <Icon>
          <SpinningLoadingIcon />
        </Icon>
      );
    case PlayerPresence.ERROR:
      return (
        <Icon style={{ color: colors.RED1 }}>
          <AlertIcon />
        </Icon>
      );
  }

  return ReactNull;
}
