---
name: astryx
description: Build or modify React interfaces with Meta's Astryx design system. Use when a user requests Astryx components, themes, templates, or CLI tooling.
---

# Astryx

Use Astryx when the user chooses it or the project already uses it. Inspect the project's dependencies and existing conventions before changing its UI. Astryx requires React 19 or later; use the project's installed version and check its documentation for current APIs.

Discover the right component and usage with the Astryx CLI before implementing:

- `astryx search <query>` searches components, docs, hooks, templates, and themes.
- `astryx component --list` lists components; `astryx component <Name>` reads component documentation.
- `astryx docs` browses documentation; `astryx theme --help` and `astryx template --help` show theme and template commands.
- `astryx doctor` diagnoses an existing Astryx project.

Prefer existing components and the project's theme; use the documented accessibility and composition APIs. Check the CLI's output and the project's code rather than inventing props or imports. Astryx ships prebuilt CSS; follow the current core documentation for CSS imports and the theme provider. Verify changes with the project's relevant checks and, for visible UI changes, inspect the result when possible.

For installation, see [INSTALL.md](INSTALL.md). Official references: [Astryx](https://github.com/meta/astryx) and [documentation](https://astryx.atmeta.com).
