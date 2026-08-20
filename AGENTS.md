# Project workflow

- After implementing and verifying a project change, automatically stage only the files changed for that task, commit them, and push the current branch to its configured upstream.
- Do not stage untracked local helpers, binaries, build output, or unrelated user changes unless the user explicitly asks to include them.
- Run the relevant build or tests before pushing, and report the result.
