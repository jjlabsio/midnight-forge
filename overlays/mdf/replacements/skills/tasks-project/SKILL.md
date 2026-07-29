---
name: tasks-project
description: "Show the current project's MDF task board."
---

# tasks-project

Resolve the canonical root and render a read-only task board with:

```bash
node <plugin-root>/skills/task/scripts/task-store.mjs <canonical-root> list
```

Do not write MDF state, inspect artifacts beyond the helper's adjacent
`item.md` check, repair data, interpret legacy schemas, migrate state, or read
an index or lock. Show helper errors as warnings and stop the affected project.
Render active, queue, done, and cancelled tasks from current state; sort queue
by due date when present, then order and created date. There is no `stale` or
`clean` operation.
