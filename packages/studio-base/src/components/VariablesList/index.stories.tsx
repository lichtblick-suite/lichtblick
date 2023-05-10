// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StoryObj } from "@storybook/react";
import { fireEvent, screen } from "@storybook/testing-library";
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

const bigVariableInitialState = {
  globalVariables: {
    big: {
      cameraState: {
        distance: 20,
        perspective: true,
        phi: 60,
        target: [0, 0, 0],
        targetOffset: [0, 0, 0],
        targetOrientation: [0, 0, 0, 1],
        thetaOffset: 45,
        fovy: 45,
        near: 0.5,
        far: 5000,
      },
    },
  },
};

export const Default: StoryObj = {
  render: () => {
    return (
      <DndProvider backend={HTML5Backend}>
        <MockCurrentLayoutProvider>
          <VariablesList />
        </MockCurrentLayoutProvider>
      </DndProvider>
    );
  },
};

export const Interactive: StoryObj = {
  render: function Story() {
    return (
      <DndProvider backend={HTML5Backend}>
        <MockCurrentLayoutProvider>
          <VariablesList />
        </MockCurrentLayoutProvider>
      </DndProvider>
    );
  },

  play: async () => {
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
  },

  parameters: { colorScheme: "light" },
};

export const WithBigVariable: StoryObj = {
  render: function Story() {
    return (
      <DndProvider backend={HTML5Backend}>
        <MockCurrentLayoutProvider initialState={bigVariableInitialState}>
          <VariablesList />
        </MockCurrentLayoutProvider>
      </DndProvider>
    );
  },

  parameters: { colorScheme: "light" },
};

export const WithVariablesLight: StoryObj = {
  render: function Story() {
    return (
      <DndProvider backend={HTML5Backend}>
        <MockCurrentLayoutProvider initialState={initialState}>
          <VariablesList />
        </MockCurrentLayoutProvider>
      </DndProvider>
    );
  },

  parameters: { colorScheme: "light" },
};

export const WithVariablesDark: StoryObj = {
  render: function Story() {
    return (
      <DndProvider backend={HTML5Backend}>
        <MockCurrentLayoutProvider initialState={initialState}>
          <VariablesList />
        </MockCurrentLayoutProvider>
      </DndProvider>
    );
  },

  parameters: { colorScheme: "dark" },
};
