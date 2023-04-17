// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Story } from "@storybook/react";
import { useSnackbar } from "notistack";
import { useEffect } from "react";

import StudioToastProvider from "@foxglove/studio-base/components/StudioToastProvider";

export default {
  title: "components/StudioToastProvider",
  component: StudioToastProvider,
  parameters: {
    chromatic: {
      delay: 100,
    },
    colorScheme: "dark",
  },
  decorators: [
    (StoryFn: Story): JSX.Element => {
      return (
        <StudioToastProvider>
          <StoryFn />
        </StudioToastProvider>
      );
    },
  ],
};

export const OneError = (): JSX.Element => {
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    enqueueSnackbar("Something bad happened", { variant: "error", persist: true });
  }, [enqueueSnackbar]);

  return <StudioToastProvider />;
};

export const OneWarning = (): JSX.Element => {
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    enqueueSnackbar("This is the final countdown", { variant: "warning", persist: true });
  }, [enqueueSnackbar]);

  return <StudioToastProvider />;
};

export const OneInfo = (): JSX.Element => {
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    enqueueSnackbar("This is the final countdown", { variant: "info", persist: true });
  }, [enqueueSnackbar]);

  return <StudioToastProvider />;
};

export const MultipleMessages = (): JSX.Element => {
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    enqueueSnackbar("Something bad happened 1", { variant: "error", persist: true });
    enqueueSnackbar("Here's a helpful tip", { variant: "default", persist: true });
    enqueueSnackbar("Just a warning", { variant: "warning", persist: true });
    enqueueSnackbar("Great job!", { variant: "success", persist: true });
    enqueueSnackbar("Something happened 2", { variant: "info", persist: true });
  }, [enqueueSnackbar]);

  return <StudioToastProvider />;
};

export const MultipleMessagesLightTheme = MultipleMessages.bind(undefined);
(MultipleMessagesLightTheme as any).parameters = { colorScheme: "light" };
