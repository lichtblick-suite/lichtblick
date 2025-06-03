// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PropsWithChildren } from "react";

/**
 * Reduces the amount of nesting required to wrap a subtree with multiple React context providers.
 * Rather than indenting each provider inside the next, all providers can be passed in a flat array
 * to the MultiProvider.
 */
export default function MultiProvider({
  children,
  providers,
}: PropsWithChildren<{ providers: readonly React.JSX.Element[] }>): React.JSX.Element {
  const wrapped = providers.reduceRight(
    (wrappedChildren, provider) => React.cloneElement(provider, undefined, wrappedChildren),
    children,
  );
  // TS requires our return type to be Element instead of Node
  return <>{wrapped}</>;
}
