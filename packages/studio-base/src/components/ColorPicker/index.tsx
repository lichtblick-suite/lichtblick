// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  Callout,
  DefaultButton,
  DirectionalHint,
  IconButton,
  ColorPicker as Picker,
} from "@fluentui/react";
import { useRef, useState } from "react";

import { Color } from "@foxglove/regl-worldview";
import { colorObjToIColor, getColorFromIRGB } from "@foxglove/studio-base/util/colorUtils";
import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";

type Props = {
  color?: Color;
  onChange: (newColor: Color) => void;
  buttonShape?: "circle" | "default";
  circleSize?: number;
  alphaType?: "alpha" | "none";
};

// Returns a button that pops out an ColorPicker in a fluent callout.
export default function ColorPicker({
  color,
  circleSize = 25,
  onChange,
  buttonShape,
  alphaType,
}: Props): JSX.Element {
  const fluentColor = colorObjToIColor(color);
  const colorButtonRef = useRef<HTMLElement>(ReactNull);
  const [colorPickerShown, setColorPickerShown] = useState(false);

  let button;
  switch (buttonShape) {
    case "circle":
      button = (
        <IconButton
          elementRef={colorButtonRef}
          styles={{
            root: {
              backgroundColor: fluentColor.str,
              width: `${circleSize}px`,
              height: `${circleSize}px`,
              borderRadius: "50%",
            },
            rootHovered: { backgroundColor: fluentColor.str, opacity: 0.8 },
            rootPressed: { backgroundColor: fluentColor.str, opacity: 0.6 },
          }}
          onClick={() => setColorPickerShown(!colorPickerShown)}
        />
      );
      break;
    default:
      button = (
        <DefaultButton
          elementRef={colorButtonRef}
          styles={{
            root: { backgroundColor: fluentColor.str },
            rootHovered: { backgroundColor: fluentColor.str, opacity: 0.8 },
            rootPressed: { backgroundColor: fluentColor.str, opacity: 0.6 },
          }}
          onClick={() => setColorPickerShown(!colorPickerShown)}
        />
      );
      break;
  }

  return (
    <div>
      {button}
      {colorPickerShown && (
        <Callout
          directionalHint={DirectionalHint.topCenter}
          target={colorButtonRef.current}
          onDismiss={() => {
            setColorPickerShown(false);
          }}
        >
          <Picker
            color={colorObjToIColor(color)}
            alphaType={alphaType ?? "none"}
            styles={{
              tableHexCell: { width: "35%" },
              input: {
                input: {
                  fontFeatureSettings: `${fonts.SANS_SERIF_FEATURE_SETTINGS}, 'zero'`,
                },
              },
            }}
            onChange={(_event, newValue) => onChange(getColorFromIRGB(newValue))}
          />
        </Callout>
      )}
    </div>
  );
}
