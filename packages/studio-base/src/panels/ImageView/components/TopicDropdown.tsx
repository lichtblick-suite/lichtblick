// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import {
  MenuItem,
  Select,
  ListItemText,
  SelectChangeEvent,
  Radio,
  ListSubheader,
  SelectProps,
} from "@mui/material";
import { useMemo } from "react";

type TopicDropdownItem = {
  name: string;
  selected: boolean;
};

type Props = {
  title: string;
  items: TopicDropdownItem[];
  multiple: boolean;
  size?: SelectProps["size"];
  open?: boolean;

  onChange: (activeTopics: string[]) => void;
};

export function TopicDropdown(props: Props): JSX.Element {
  const { items, onChange, multiple, title, size = "small" } = props;

  const selectedTopics = useMemo<string[]>(() => {
    return items.filter((item) => item.selected).map((item) => item.name);
  }, [items]);

  const handleChange = (event: SelectChangeEvent<string[]>) => {
    const {
      target: { value },
    } = event;
    onChange(typeof value === "string" ? [value] : value);
  };

  return (
    <>
      <Select
        value={selectedTopics}
        disabled={items.length === 0}
        displayEmpty
        renderValue={(_selected) => title}
        title={title}
        size={size}
        onChange={handleChange}
        multiple={multiple}
        open={props.open}
        MenuProps={{
          contentEditable: multiple,
          MenuListProps: {
            dense: true,
            subheader: multiple ? <ListSubheader>Select multiple topics</ListSubheader> : undefined,
          },
        }}
      >
        {items.length === 0 && (
          <MenuItem disabled value="">
            <ListItemText
              primary="No topics"
              primaryTypographyProps={{ variant: "inherit", color: "text.secondary" }}
            />
          </MenuItem>
        )}
        {items.map((item) => (
          <MenuItem key={item.name} value={item.name}>
            <Radio
              checked={selectedTopics.includes(item.name)}
              size="small"
              edge="start"
              checkedIcon={<CheckCircleIcon />}
            />
            <ListItemText primary={item.name} primaryTypographyProps={{ variant: "inherit" }} />
          </MenuItem>
        ))}
      </Select>
    </>
  );
}
