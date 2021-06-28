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

import { storiesOf } from "@storybook/react";
import { useEffect, useMemo } from "react";
import TestUtils from "react-dom/test-utils";

import ShareJsonModal from "@foxglove/studio-base/components/ShareJsonModal";
import CurrentLayoutContext, {
  useCurrentLayoutActions,
} from "@foxglove/studio-base/context/CurrentLayoutContext";
import { PanelsState } from "@foxglove/studio-base/context/CurrentLayoutContext/actions";
import CurrentLayoutState, {
  DEFAULT_LAYOUT_FOR_TESTS,
} from "@foxglove/studio-base/providers/CurrentLayoutProvider/CurrentLayoutState";
import { LayoutID } from "@foxglove/studio-base/services/ILayoutStorage";

storiesOf("components/ShareJsonModal", module)
  .addDecorator((Child: any) => {
    const currentLayout = useMemo(() => new CurrentLayoutState(DEFAULT_LAYOUT_FOR_TESTS), []);
    return (
      <CurrentLayoutContext.Provider value={currentLayout}>
        <Child />
      </CurrentLayoutContext.Provider>
    );
  })
  .add("standard", () => (
    <ShareJsonModal
      onRequestClose={() => {
        // no-op
      }}
      value=""
      onChange={() => {
        // no-op
      }}
      noun="layout"
    />
  ))
  .add("submitting invalid layout", () => {
    useEffect(() => {
      setTimeout(() => {
        const textarea: any = document.querySelector("textarea");
        textarea.value = "{";
        TestUtils.Simulate.change(textarea);
        setTimeout(() => {
          document.querySelector<HTMLElement>(".test-apply")?.click();
        }, 10);
      }, 10);
    }, []);
    const { setSelectedLayout } = useCurrentLayoutActions();
    return (
      <div data-modalcontainer="true">
        <ShareJsonModal
          onRequestClose={() => {
            // no-op
          }}
          value={""}
          onChange={(value) =>
            setSelectedLayout({ id: "X" as LayoutID, data: value as Partial<PanelsState> })
          }
          noun="layout"
        />
      </div>
    );
  });
