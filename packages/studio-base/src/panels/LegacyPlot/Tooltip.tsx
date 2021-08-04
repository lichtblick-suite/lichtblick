// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

type Position = { x: number; y: number };
type TooltipProps = {
  datapoints: Position[];
};

export const TwoDimensionalTooltip = (props: TooltipProps): JSX.Element => {
  const { datapoints } = props;
  return (
    <div>
      {datapoints
        .sort((a, b) => b.y - a.y)
        .map(({ x, y }, i) => {
          return (
            <div key={i} style={{ padding: "4px 0", display: "flex", alignItems: "center" }}>
              <div>
                {x}, {y}
              </div>
            </div>
          );
        })}
    </div>
  );
};
