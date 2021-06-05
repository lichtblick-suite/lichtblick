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

export type Node = {
  id: string;
  text: string;
  tooltip?: React.ReactNode[];
  icon?: React.ReactNode;
  checked: boolean;
  disabled?: boolean;
  expanded?: boolean;
  visible: boolean;
  filtered?: boolean;
  missing?: boolean;
  children: Node[];
  canEdit?: boolean;
  hasEdit?: boolean;
  hasCheckbox?: boolean;
  name?: string;
  topic?: string;
  namespace?: string;
};
