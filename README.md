<h1 align="center">Lichtblick</h1>

<div align="center">
  <a href="https://github.com/lichtblick-suite/lichtblick/stargazers"><img src="https://img.shields.io/github/stars/lichtblick-suite/lichtblick" alt="Stars Badge"/></a>
  <a href="https://github.com/lichtblick-suite/lichtblick/network/members"><img src="https://img.shields.io/github/forks/lichtblick-suite/lichtblick" alt="Forks Badge"/></a>
  <a href="https://github.com/lichtblick-suite/lichtblick/pulls"><img src="https://img.shields.io/github/issues-pr/lichtblick-suite/lichtblick" alt="Pull Requests Badge"/></a>
  <a href="https://github.com/lichtblick-suite/lichtblick/issues"><img src="https://img.shields.io/github/issues/lichtblick-suite/lichtblick" alt="Issues Badge"/></a>
  <a href="https://github.com/lichtblick-suite/lichtblick/issues"><img src="https://img.shields.io/github/package-json/v/lichtblick-suite/lichtblick" alt="Versions Badge"/></a>
  <a href="https://github.com/lichtblick-suite/lichtblick/graphs/contributors"><img alt="GitHub contributors" src="https://img.shields.io/github/contributors/lichtblick-suite/lichtblick?color=2b9348"></a>
 <img alt="GitHub License" src="https://img.shields.io/github/license/lichtblick-suite/lichtblick">

  <br />
<p  align="center">
Lichtblick is an integrated visualization and diagnosis tool for robotics, available in your browser or as a desktop app on Linux, Windows, and macOS.
</p>
  <p align="center">
    <img alt="Lichtblick screenshot" src="resources/screenshot.png">
  </p>
</div>

**Dependencies:**

- [Node.js](https://nodejs.org/en/) v16.10+
- [Git LFS](https://git-lfs.github.com/)

<hr/>

## :rocket: Getting started

Clone the repository:

```sh
$ git clone https://github.com/lichtblick-suite/lichtblick.git
```

Pull large files with Git LFS:

```sh
$ git lfs pull
```

Enable corepack:

```sh
$ corepack enable
```

Install packages from `package.json`:

```sh
$ yarn install
```

- If you still get errors about corepack after running `corepack enable`, try uninstalling and reinstalling Node.js. Ensure that Yarn is not separately installed from another source, but is installed _via_ corepack.

Launch the development environment:

```sh
# To launch the desktop app (run scripts in different terminals):
$ yarn desktop:serve        # start webpack dev server
$ yarn desktop:start        # launch electron (make sure the desktop:serve finished to build)

# To launch the web app:
$ yarn run web:serve        # it will be avaiable in http://localhost:8080
```

## :hammer_and_wrench: Building Lichtblick

Build the application for production using these commands:

```sh
# To build the desktop apps:
$ yarn run desktop:build:prod   # compile necessary files

- yarn run package:win         # Package for windows
- yarn run package:darwin      # Package for macOS
- yarn run package:linux       # Package for linux

# To build the web app:
$ yarn run web:build:prod

# To build and run the web app using docker:
$ docker build . -t lichtblick
$ docker run -p 8080:8080 lichtblick

# It is possible to clean up build files using the following command:
$ yarn run clean
```

- The desktop builds are located in the `dist` directory, and the web builds are found in the `web/.webpack` directory.

## :pencil: License (Open Source)

Lichtblick follows an open core licensing model. Most functionality is available in this repository, and can be reproduced or modified per the terms of the [Mozilla Public License v2.0](/LICENSE).

## :handshake: Contributing

Contributions are welcome! Lichtblick is primarily built in TypeScript and ReactJS. All potential contributors must agree to the Contributor License Agreement outlined in [CONTRIBUTING.md](CONTRIBUTING.md).

## :star: Credits

Lichtblick originally began as a fork of [FoxGlove Studio](https://github.com/foxglove/studio), an open source project developed by [Foxglove](https://app.foxglove.dev/).
