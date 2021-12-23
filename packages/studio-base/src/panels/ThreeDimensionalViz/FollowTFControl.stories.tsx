// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { action } from "@storybook/addon-actions";
import { Story } from "@storybook/react";

import { TransformTree } from "@foxglove/studio-base/panels/ThreeDimensionalViz/transforms";

import FollowTFControl from "./FollowTFControl";

export default {
  title: "panels/ThreeDimensionalViz/FollowTFControl",
  component: FollowTFControl,
};

export const NoTransformsNoFollow: Story = () => {
  return (
    <FollowTFControl
      followMode="no-follow"
      transforms={new TransformTree()}
      onFollowChange={action("onFollowChange")}
    />
  );
};

export const NoTransforms: Story = () => {
  return (
    <FollowTFControl
      followTf="some_frame"
      followMode="no-follow"
      transforms={new TransformTree()}
      onFollowChange={action("onFollowChange")}
    />
  );
};

export const FollowNotFound: Story = () => {
  const tree = new TransformTree();
  tree.getOrCreateFrame("new_frame");

  return (
    <FollowTFControl
      followTf="some_frame"
      followMode="no-follow"
      transforms={tree}
      onFollowChange={action("onFollowChange")}
    />
  );
};

export const Following: Story = () => {
  const tree = new TransformTree();
  tree.getOrCreateFrame("new_frame");

  return (
    <FollowTFControl
      followTf="new_frame"
      followMode="follow"
      transforms={tree}
      onFollowChange={action("onFollowChange")}
    />
  );
};
