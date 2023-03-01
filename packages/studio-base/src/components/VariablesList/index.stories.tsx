// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { fireEvent, screen } from "@testing-library/dom";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

import MockCurrentLayoutProvider from "@foxglove/studio-base/providers/CurrentLayoutProvider/MockCurrentLayoutProvider";

import VariablesList from ".";

export default {
  title: "components/VariablesList",
  component: VariablesList,
};

const initialState = {
  globalVariables: {
    selected_id: 1234,
  },
};

export function Default(): JSX.Element {
  return (
    <DndProvider backend={HTML5Backend}>
      <MockCurrentLayoutProvider>
        <VariablesList />
      </MockCurrentLayoutProvider>
    </DndProvider>
  );
}

export function Interactive(): JSX.Element {
  return (
    <DndProvider backend={HTML5Backend}>
      <MockCurrentLayoutProvider>
        <VariablesList />
      </MockCurrentLayoutProvider>
    </DndProvider>
  );
}
Interactive.play = async () => {
  const addButton = await screen.findByTestId("add-variable-button");
  fireEvent.click(addButton);

  const input = await screen.findByPlaceholderText("variable_name");
  fireEvent.change(input, { target: { value: "new_variable_name" } });

  const valueInput = await screen.findByDisplayValue('""');
  fireEvent.change(valueInput, { target: { value: '"edited value"' } });

  const menuButton = await screen.findByTestId("variable-action-button");
  fireEvent.click(menuButton);

  await screen.findByTestId("global-variable-key-input-new_variable_name");

  const menuButton2 = await screen.findByTestId("variable-action-button");
  fireEvent.click(menuButton2);

  const deleteButton = await screen.findByText("Delete variable");
  fireEvent.click(deleteButton);
};

Interactive.parameters = { colorScheme: "light" };

export function WithVariablesLight(): JSX.Element {
  return (
    <DndProvider backend={HTML5Backend}>
      <MockCurrentLayoutProvider initialState={initialState}>
        <VariablesList />
      </MockCurrentLayoutProvider>
    </DndProvider>
  );
}

WithVariablesLight.parameters = { colorScheme: "light" };

export function WithVariablesDark(): JSX.Element {
  return (
    <DndProvider backend={HTML5Backend}>
      <MockCurrentLayoutProvider initialState={initialState}>
        <VariablesList />
      </MockCurrentLayoutProvider>
    </DndProvider>
  );
}

WithVariablesDark.parameters = { colorScheme: "dark" };
