// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useMemo } from "react";

import { SidebarContent } from "@foxglove/studio-base/components/SidebarContent";
import { useCurrentUser } from "@foxglove/studio-base/context/CurrentUserContext";

import AccountInfo from "./AccountInfo";
import SigninForm from "./SigninForm";

export default function AccountSettings(): JSX.Element {
  const { currentUser } = useCurrentUser();

  const content = useMemo(() => {
    if (!currentUser) {
      return <SigninForm />;
    }

    return <AccountInfo currentUser={currentUser} />;
  }, [currentUser]);

  return <SidebarContent title="Account">{content}</SidebarContent>;
}
