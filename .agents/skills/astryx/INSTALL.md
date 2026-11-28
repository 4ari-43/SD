# Installing Astryx

Astryx is a React design system. React 19 or later and `react-dom` are required peer dependencies. In an existing React project, install the core package, a theme, StyleX, and the project CLI:

```bash
npm install @astryxdesign/core @astryxdesign/theme-neutral @stylexjs/stylex
npm install -D @astryxdesign/cli
```

Follow the [core setup guide](https://github.com/meta/astryx/tree/main/packages/core) for CSS imports, the theme provider, and framework-specific setup. Check the project before adding dependencies or changing its existing theme.

Optionally install the CLI globally to access its documentation from any folder:

```bash
npm install -g @astryxdesign/cli
astryx --version
```

A project-local CLI takes precedence inside that project. Global installation does not install the React packages into a project. Run `astryx docs global` for global setup and troubleshooting. If npm blocks the CLI postinstall script, consult npm's script policy and `astryx docs global` before explicitly allowing it; verify the CLI with `astryx --version`.

To make this skill available to an agent, copy the `astryx` folder to that agent's skills directory (for Codex, `~/.codex/skills/astryx`), then restart or refresh the agent if needed. This skill and the Astryx CLI are separate installations.
