# EDUmind Board

EDUmind Board is a local-first classroom board PWA for creating teaching
boards, projecting them in class and sharing read-only views.

This public repository is a sanitized source release for code review,
educational reuse and community audit. Production secrets, deployment
configuration, private runbooks, backups, SQLite databases and uploaded
user content are not included.

## Development

```bash
npm install
npm --workspace @edumind-board/shared run build
npm run typecheck
npm run build
```

For local development, copy `.env.example` if needed and replace all
placeholder values with local-only secrets.

## Release Scope

See `OPEN_SOURCE_RELEASE.md` for what is included and excluded.

## License

Licensed under `AGPL-3.0-or-later OR EUPL-1.2`.

EDUmind(R), logos and brand assets are reserved. See `TRADEMARKS.md`.
