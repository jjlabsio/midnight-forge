---
name: tasks-user
description: "Show MDF task boards across registered local projects."
---

# tasks-user

Read `~/.mdf/projects.json`; for each canonical root invoke the current-state
helper's `list` operation. This command is read-only: it does not initialize,
repair, migrate, scan artifacts, inspect legacy index data, or write any MDF
file. Warn and continue when one project is unreadable or malformed. Render
active, queue, done, and cancelled tasks and recommend only ready queue tasks.
