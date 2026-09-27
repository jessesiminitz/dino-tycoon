# Dino Tycoon

Read `HANDOFF.md` first: it has the project state, conventions, deploy steps (including the git push credential workaround), the owner's preferences, and the browser checks.

Key rules:
- Node 22 via nvm: `export PATH=~/.nvm/versions/node/v22.23.3/bin:$PATH`.
- Run `npm test` and `npm run build` before committing. After UI changes, run the phone-size checks in `scripts/checks/`.
- State shape changes need a `SAVE_VERSION` bump plus a `migrate()` step.
- Commit and deploy (push to `main`) after each round of changes.
- Keep the game kid-friendly. Use only public-domain music.
