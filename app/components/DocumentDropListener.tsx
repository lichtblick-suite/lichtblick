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

type Props = {
  children: React.ReactNode; // Shown when dragging in a file.
  filesSelected: (arg0: {
    files: FileList | File[];
    shiftPressed: boolean;
    onConfirmLocalFilesModalClose?: () => void;
  }) => any;
};

type State = {
  hovering: boolean;
};

export default class DocumentDropListener extends React.PureComponent<Props, State> {
  state = { hovering: false };

  componentDidMount() {
    document.addEventListener("dragover", this._onDragOver);
    document.addEventListener("drop", this._onDrop);
    document.addEventListener("dragleave", this._onDragLeave);
  }

  componentWillUnmount() {
    document.removeEventListener("dragover", this._onDragOver);
    document.removeEventListener("drop", this._onDrop);
    document.removeEventListener("dragleave", this._onDragLeave);
  }

  _onDrop = (ev: DragEvent) => {
    const { filesSelected } = this.props;
    if (!ev.dataTransfer) {
      return;
    }
    const { files } = ev.dataTransfer;
    // allow event to bubble for non-file based drag and drop
    if (!files.length) {
      return;
    }
    ev.preventDefault();
    ev.stopPropagation();
    filesSelected({ files, shiftPressed: ev.shiftKey });
    this.setState({ hovering: false });
  };

  _onDragOver = (ev: DragEvent) => {
    const { dataTransfer } = ev;
    // dataTransfer isn't guaranteed to exist by spec, so it must be checked
    if (dataTransfer && dataTransfer.types.length === 1 && dataTransfer.types[0] === "Files") {
      ev.stopPropagation();
      ev.preventDefault();
      dataTransfer.dropEffect = "copy";
      this.setState({ hovering: true });
    }
  };

  _onDragLeave = () => {
    this.setState({ hovering: false });
  };

  render() {
    return (
      <>
        <input // Expose a hidden input for Puppeteer to use to drop a file in.
          type="file"
          style={{ display: "none" }}
          onChange={(event) =>
            this.props.filesSelected({ files: event.target.files as any, shiftPressed: false })
          }
          data-puppeteer-file-upload
          multiple
        />
        {this.state.hovering && this.props.children}
      </>
    );
  }
}
