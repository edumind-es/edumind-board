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

## Classroom Desktop Inspiration

EDUmind Board includes a "Escritorio docente" board template that packages
EDUmind apps, classroom resources, timers and visual classroom state into a
single board-style workspace.

This template is inspired by the educational desktop approach of
`jjdeharo/escritorio`:

- Repository: <https://github.com/jjdeharo/escritorio>
- Reviewed commit: `9c939e8c6bb2105a4e54ad4a21ffeb4ebd189523`
- Author credited by the repository: Juan Jose de Haro
- The upstream README credits the original "Escritorio Interactivo para el Aula"
  idea to Maria Teresa Gonzalez and credits the React migration/collaboration to
  Maria Teresa Gonzalez and Juan Jose de Haro.
- Upstream license notice: Creative Commons Attribution-ShareAlike 4.0
  International (`CC BY-SA 4.0`), as stated in the upstream README.

No source code, images, sounds or other assets from `jjdeharo/escritorio` are
copied into this repository by this template. If future changes reuse upstream
code or assets directly, preserve the corresponding `CC BY-SA 4.0` attribution
and share-alike obligations in the affected files and release materials.

## License

Licensed under `AGPL-3.0-or-later OR EUPL-1.2`.

EDUmind(R), logos and brand assets are reserved. See `TRADEMARKS.md`.
