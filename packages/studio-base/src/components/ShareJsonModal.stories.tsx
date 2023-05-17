// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StoryObj } from "@storybook/react";
import { fireEvent, screen } from "@storybook/testing-library";

import {
  ShareJsonModal,
  ShareJsonModalProps,
} from "@foxglove/studio-base/components/ShareJsonModal";

export default {
  title: "components/ShareJsonModal",
};

const sharedProps: ShareJsonModalProps = {
  title: "Foo",
  onChange: () => {},
  onRequestClose: () => {},
  initialValue: "",
};

export const Standard: StoryObj = {
  render: () => <ShareJsonModal {...sharedProps} />,
  parameters: { colorScheme: "dark" },
};

export const StandardLight: StoryObj = {
  render: () => <ShareJsonModal {...sharedProps} />,
  parameters: { colorScheme: "light" },
};

export const JSON: StoryObj = {
  render: () => <ShareJsonModal {...sharedProps} initialValue={{ foo: "bar", baz: "qux" }} />,
  parameters: { colorScheme: "dark" },
};

export const SubmittingInvalidLayout: StoryObj = {
  render: () => <ShareJsonModal {...sharedProps} />,
  parameters: { colorScheme: "dark" },
  play: async () => {
    const textarea = await screen.findByTestId("share-json-input");
    fireEvent.change(textarea, { target: { value: "{" } });
  },
};
