# <img src="resources/icon/icon.png" width="40" height="40" align="top"> Foxglove Studio

Foxglove Studio ([foxglove.dev](https://foxglove.dev)) is an integrated visualization and diagnosis tool for robotics, available for [download](https://foxglove.dev/download) as a desktop app on Linux, Windows, and macOS.

<p align="center">
  <a href="https://foxglove.dev"><img alt="Foxglove Studio screenshot" src="/resources/screenshot.png"></a>
</p>

To learn more, visit the following resources:

- [About](https://foxglove.dev/about)
- [Documentation](https://foxglove.dev/docs)
- [Release notes](https://github.com/foxglove/studio/releases)
- [ROS Wiki page](http://wiki.ros.org/FoxgloveStudio)
- [Blog](https://foxglove.dev/blog)

You can also join us on the following platforms to ask questions, share feedback, and stay up-to-date on what our team is working on:

- [GitHub Discussions](https://github.com/foxglove/studio/discussions)
- [Slack](https://foxglove.dev/join-slack)
- [Newsletter](https://www.getrevue.co/profile/foxglove)
- [Twitter](https://twitter.com/foxglovedev)
- [LinkedIn](https://www.linkedin.com/company/foxglovedev)

## Installation

Visit [foxglove.dev/download](https://foxglove.dev/download) or [GitHub Releases](https://github.com/foxglove/studio/releases) to download the latest version.

## Contributing

Foxglove Studio is primarily written in TypeScript – contributions are welcome!

**Supported development environments:** Linux, Windows, macOS

**Dependencies:**

- [Node.js](https://nodejs.org/en/) v14+
- [Yarn](https://yarnpkg.com/getting-started/install) – `npm install -g yarn`
- [Git LFS](https://git-lfs.github.com/)
- [Visual Studio Code](https://code.visualstudio.com/) – Recommended

**Getting started:**

1. Clone repo
1. Run `yarn install`
1. Launch the development environment (run both scripts concurrently):

```sh
$ yarn serve        # start webpack
$ yarn start        # launch electron

# Advanced usage: running webpack and electron on different computers (or VMs) on the same network
$ yarn serve --host 192.168.xxx.yyy         # the address where electron can reach the webpack dev server
$ yarn dlx electron@13.0.0-beta.13 .webpack # launch the version of electron for the current computer's platform
```

**Other useful commands:**

```sh
$ yarn run          # list available commands
$ yarn lint         # lint all files
$ yarn test         # run all tests
$ yarn test:watch   # run tests on changed files
```

### Credits

Foxglove Studio began as a fork of [Webviz](https://github.com/cruise-automation/webviz), an open source project developed by [Cruise](https://getcruise.com/).
