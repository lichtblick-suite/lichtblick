// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import React from "react";

export const OVERLAY_STYLE: React.CSSProperties = {
  position: "absolute",
  top: "10px",
  left: "10px",
  maxWidth: "50%",
  maxHeight: "40%",
  overflowY: "auto",
  padding: "8px",
  backgroundColor: "rgba(0, 0, 0, 0.7)",
  color: "white",
  borderRadius: "4px",
  fontSize: "12px",
  // Make sure clicks pass through to components underneath
  pointerEvents: "none",
  zIndex: 100,
};

export function HUDInfoMessagesPanel(props: {
  infoMessages: ReadonlyArray<string>;
}): React.JSX.Element {
  const { infoMessages } = props;

  if (infoMessages.length === 0) {
    return <></>; // Don't render the overlay if there are no messages
  }

  return (
    <div id="infoMessagesPanel" style={OVERLAY_STYLE}>
      {infoMessages.map((text, index) => (
        <div key={`hud-info-${index}`}>
          <div>{text}</div>
        </div>
      ))}
    </div>
  );
}
