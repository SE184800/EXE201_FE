# Mobile and responsive styles

`index.css` is the only responsive stylesheet imported by the application. It
loads after the desktop and feature styles, so smaller-screen overrides keep a
predictable priority.

## Files

- `global-mobile.css`: login, registration, shared workspace and supplier shell.
- `store-mobile.css`: store navigation, inventory cards, voice sale and chatbot.
- `catalog-mobile.css`: wholesale catalog, checkout, quotes and product publishing.
- `subscription-mobile.css`: trial and monthly subscription screens.
- `revenue-mobile.css`: revenue filters, metrics, charts and tables.
- `admin-mobile.css`: admin navigation, reports, tables and bottom-sheet dialogs.

## Team convention

1. Put normal desktop/component styles beside the feature.
2. Put `@media (... max-width ...)` or small-screen `@container` overrides in the
   matching file in this folder.
3. Keep the fixed bottom navigation above `z-index: 80`.
4. Use at least `42px` for frequently tapped controls.
5. Run `npm run format`, `npm run lint`, and `npm run build` before pushing.

The Android project lives in `android/`. Regenerate its copied web assets with
`npm run mobile:sync`, then build an installable debug APK with
`npm run mobile:apk`.
