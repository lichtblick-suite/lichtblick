[![Accelerate your robotics development](https://user-images.githubusercontent.com/14011012/195918769-5aaeedf3-5de2-48fb-951e-7399f2b9e190.png)](https://foxglove.dev)

<br/>

<div align="center">
    <h1>Foxglove Studio</h1>
    <a href="https://github.com/foxglove/studio#contributing"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" /></a>
    <a href="https://github.com/foxglove/studio/blob/main/LICENSE"><img src="https://img.shields.io/aur/license/foxglove-studio" /></a>
    <a href="https://foxglove.dev/join-slack"><img src="https://img.shields.io/badge/chat-on%20slack-purple.svg" /></a>
    <br />
    <br />
    <a href="https://foxglove.dev/download">Download</a>
    <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
    <a href="https://foxglove.dev/docs/studio">Docs</a>
    <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
    <a href="https://foxglove.dev/blog">Blog</a>
    <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
    <a href="https://foxglove.dev/demo">Demo</a>
    <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
    <a href="https://foxglove.dev/contact">Contact Us</a>
    <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
    <a href="https://foxglove.dev/slack">Slack</a>
    <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
    <a href="https://twitter.com/foxglovedev">Twitter</a>
  <br />
  <br />

[Foxglove Studio](https://foxglove.dev) is an integrated visualization and diagnosis tool for robotics, available [in your browser](https://studio.foxglove.dev/) or [as a desktop app](https://foxglove.dev/download) on Linux, Windows, and macOS.

  <p align="center">
    <a href="https://foxglove.dev"><img alt="Foxglove Studio screenshot" src="/resources/screenshot.png"></a>
  </p>
</div>

<hr />

To learn more, visit the following resources:

[About](https://foxglove.dev/about)
&nbsp;•&nbsp;
[Documentation](https://foxglove.dev/docs)
&nbsp;•&nbsp;
[Release notes](https://github.com/foxglove/studio/releases)
&nbsp;•&nbsp;
[ROS Wiki page](http://wiki.ros.org/FoxgloveStudio)
&nbsp;•&nbsp;
[Blog](https://foxglove.dev/blog)

You can also join us on the following platforms to ask questions, share feedback, and stay up to date on what our team is working on:

[GitHub Discussions](https://github.com/foxglove/studio/discussions)
&nbsp;•&nbsp;
[Slack](https://foxglove.dev/join-slack)
&nbsp;•&nbsp;
[Newsletter](https://www.getrevue.co/profile/foxglove)
&nbsp;•&nbsp;
[Twitter](https://twitter.com/foxglovedev)
&nbsp;•&nbsp;
[LinkedIn](https://www.linkedin.com/company/foxglovedev)

<br />

## Installation

Visit [foxglove.dev/download](https://foxglove.dev/download) or [GitHub Releases](https://github.com/foxglove/studio/releases) to download the latest version.

## Contributing

Foxglove Studio is primarily written in TypeScript – contributions are welcome!

Note: All contributors must agree to our [Contributor License Agreement](https://github.com/foxglove/cla).

**Supported development environments:** Linux, Windows, macOS

**Dependencies:**

- [Node.js](https://nodejs.org/en/) v16.10+
- [Git LFS](https://git-lfs.github.com/)
- [Visual Studio Code](https://code.visualstudio.com/) – Recommended

**Getting started:**

1. Clone repo
1. Run `corepack enable` and `yarn install`
1. Launch the development environment:

```sh
# To launch the desktop app (run both scripts concurrently):
$ yarn desktop:serve        # start webpack
$ yarn desktop:start        # launch electron

# To launch the browser app:
$ yarn web:serve

# To launch the browser app using a local instance of the backend server:
$ yarn web:serve:local

# To launch the storybook:
$ yarn storybook

# Advanced usage: running webpack and electron on different computers (or VMs) on the same network
$ yarn desktop:serve --host 192.168.xxx.yyy         # the address where electron can reach the webpack dev server
$ yarn dlx electron@13.0.0-beta.13 .webpack # launch the version of electron for the current computer's platform

# To launch the desktop app using production API endpoints
$ yarn desktop:serve --env FOXGLOVE_BACKEND=production
$ yarn desktop:start

# NOTE: yarn web:serve does not support connecting to the production endpoints
```

A [Dockerfile](/Dockerfile) to self-host the browser app is also available.

**Other useful commands:**

```sh
$ yarn run          # list available commands
$ yarn lint         # lint all files
$ yarn test         # run all tests
$ yarn test:watch   # run tests on changed files
```

## Self-hosting

Foxglove Studio can be run as a standalone [desktop application](https://foxglove.dev/download), accessed in your browser at [studio.foxglove.dev](https://studio.foxglove.dev/), or self-hosted on your own domain.

A Docker image is provided to make self-hosting easy. You can run it like so:

```sh
docker run --rm -p "8080:8080" ghcr.io/foxglove/studio:latest
```

Foxglove Studio will then be accessible in your browser at [localhost:8080](http://localhost:8080/).

For all list of available image versions, see the [package details](https://github.com/foxglove/studio/pkgs/container/studio).

## Credits

Foxglove Studio originally began as a fork of [Webviz](https://github.com/cruise-automation/webviz), an open source project developed by [Cruise](https://getcruise.com/). The codebase has since changed significantly, with a port to TypeScript, more [panels](https://foxglove.dev/docs/panels/introduction), additional [data sources](https://foxglove.dev/docs/connection/data-sources), improved [layout management](https://foxglove.dev/docs/layouts), new [team features](https://foxglove.dev/blog/announcing-foxglove-for-teams), and an [Extension API](https://foxglove.dev/docs/extensions/getting-started).
