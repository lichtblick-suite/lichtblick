// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  Checkbox,
  CheckboxProps,
  SvgIcon,
  styled as muiStyled,
  IconButtonProps,
} from "@mui/material";

const StyledCheckbox = muiStyled(Checkbox, {
  shouldForwardProp: (prop) => prop !== "size",
})<{ size: IconButtonProps["size"] }>(({ theme, size = "medium" }) => ({
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(1),

  "&:hover": {
    backgroundColor: theme.palette.action.hover,
  },
  ...(size === "small" && {
    padding: theme.spacing(0.625),
  }),
}));

export function VisibilityToggle(
  props: CheckboxProps & { size: IconButtonProps["size"] },
): JSX.Element {
  return (
    <StyledCheckbox
      {...props}
      title="Toggle visibility"
      icon={
        <SvgIcon fontSize="small" viewBox="0 0 16 16" color="disabled">
          {/* Eye open */}
          <path
            fill="currentColor"
            d="M13.508 7.801c.556-.527 1.036-1.134 1.422-1.801h-1.185C12.48 7.814 10.378 9 8 9 5.622 9 3.52 7.814 2.254 6H1.07c.386.667.866 1.274 1.421 1.801L.896 9.396l.708.707L3.26 8.446c.71.523 1.511.932 2.374 1.199l-.617 2.221.964.268.626-2.255C7.06 9.96 7.525 10 8 10c.475 0 .94-.041 1.392-.12l.626 2.254.964-.268-.617-2.221c.863-.267 1.663-.676 2.374-1.2l1.657 1.658.708-.707-1.595-1.595z"
            fillRule="nonzero"
          />
        </SvgIcon>
      }
      checkedIcon={
        <SvgIcon fontSize="small" viewBox="0 0 16 16">
          {/* Eye closed */}
          <g fill="currentColor">
            <path
              d="M8 10c1.105 0 2-.895 2-2 0-1.105-.895-2-2-2-1.104 0-2 .895-2 2 0 1.105.896 2 2 2z"
              fillRule="nonzero"
            />
            <path
              d="M8 4c2.878 0 5.378 1.621 6.635 4-1.257 2.379-3.757 4-6.635 4-2.878 0-5.377-1.621-6.635-4C2.623 5.621 5.122 4 8 4zm0 7c-2.3 0-4.322-1.194-5.478-3C3.678 6.194 5.7 5 8 5c2.3 0 4.322 1.194 5.479 3C12.322 9.806 10.3 11 8 11z"
              fillRule="evenodd"
            />
          </g>
        </SvgIcon>
      }
    />
  );
}
