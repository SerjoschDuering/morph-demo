# Contributing

Morph is a demo, not a product. The code is rough on purpose — it's here to prove a thesis, not to ship. That said, contributions are welcome.

## Before you send a PR

Open an issue first. Describe what you want to change and why. A quick conversation saves everyone a round-trip, and some areas are in flux.

## What's welcome

- Bug reports with a clear repro
- Small fixes for obvious breakage (typos, broken scripts, type errors)
- Ideas for new capabilities — especially around MCP, the app bridge, or workspace isolation
- Questions. If the architecture is unclear, that's a docs bug.

## What's less welcome right now

- Large refactors of the chat or compiler code without prior discussion
- New dependencies "just in case"
- Style-only reformatting PRs

## Development

See the README for setup. Run `npm test` for the JS side and `npm run test:rust` for the Rust side.

## No formal process

There is no CLA, no linting gate, no release schedule. If that changes, this file will change with it.
