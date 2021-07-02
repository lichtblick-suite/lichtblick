// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Stack, StackItem, Text, ActionButton } from "@fluentui/react";
import { useAsync } from "react-use";

import { useConsoleApi } from "@foxglove/studio-base/context/ConsoleApiContext";
import { Org } from "@foxglove/studio-base/services/ConsoleApi";

type OrgSelectProps = {
  idToken: string;
  onSelect: (org: Org) => void;
};

export default function OrgSelect(props: OrgSelectProps): JSX.Element {
  const api = useConsoleApi();

  const { value: orgs, error: orgsError } = useAsync(async () => {
    api.setAuthHeader(`IdToken ${props.idToken}`);
    return api.orgs();
  }, [api, props.idToken]);

  if (orgsError) {
    return (
      <Stack>
        <Text>{orgsError.message}</Text>
      </Stack>
    );
  }

  return (
    <Stack>
      <StackItem>
        <Text>Select an Org to Sign-In</Text>
      </StackItem>
      {orgs?.map((org) => {
        return (
          <StackItem key={org.id}>
            <Text variant="large">{org.display_name ?? org.slug}</Text>
            <ActionButton onClick={() => props.onSelect(org)}>Select</ActionButton>
          </StackItem>
        );
      })}
    </Stack>
  );
}
