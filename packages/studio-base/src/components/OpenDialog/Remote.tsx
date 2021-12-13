// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Stack, TextField, useTheme } from "@fluentui/react";
import path from "path";
import { useCallback, useState } from "react";

import {
  IDataSourceFactory,
  usePlayerSelection,
} from "@foxglove/studio-base/context/PlayerSelectionContext";

import View from "./View";

type RemoteProps = {
  onBack?: () => void;
  onCancel?: () => void;
  availableSources: IDataSourceFactory[];
};

export default function Remote(props: RemoteProps): JSX.Element {
  const { onCancel, onBack, availableSources } = props;

  const { selectSource } = usePlayerSelection();
  const theme = useTheme();
  const [currentUrl, setCurrentUrl] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const onOpen = useCallback(() => {
    if (!currentUrl) {
      return;
    }

    const extension = path.extname(currentUrl);
    if (extension.length === 0) {
      setErrorMessage("URL must end with a filename and extension");
      return;
    }

    // find remote supporting this extension
    const foundSource = availableSources.find((source) => {
      return source.type === "remote-file" && source.supportedFileTypes?.includes(extension);
    });
    if (!foundSource) {
      setErrorMessage(`No remote data sources available for ${extension} files`);
      return;
    }

    selectSource(foundSource.id, {
      type: "connection",
      params: {
        url: currentUrl,
      },
    });
  }, [availableSources, currentUrl, selectSource]);

  return (
    <View onBack={onBack} onCancel={onCancel} onOpen={onOpen}>
      <Stack tokens={{ childrenGap: theme.spacing.m }}>
        <TextField
          label="Remote file URL"
          errorMessage={errorMessage}
          placeholder="https://storage.googleapis.com/foxglove-public-assets/demo.bag"
          onChange={(_, newValue) => {
            setCurrentUrl(newValue);
          }}
        />
      </Stack>
    </View>
  );
}
