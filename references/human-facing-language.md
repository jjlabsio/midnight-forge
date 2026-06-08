# Human-Facing Language

Use the explicit `human_language` preference from `~/.mdf/user/preferences.json` for prose that asks the user to decide, respond, or review.

This applies to human-facing explanations, review findings, recommendations, PR titles, PR body bullet prose, and questions that require a user response.

If no initialized preference is available and the current workflow is not reading or writing MDF state, the user's apparent current-turn language may be used as a fallback. Do not infer or write `human_language` from terse command tokens, task IDs, branch names, file paths, or command shorthands.

Preserve fixed workflow contracts exactly as written. Do not translate MDF schema keys, YAML frontmatter keys, task status values, file paths, commands, code identifiers, branch names, release labels, required template headings, Conventional Commit type/scope prefixes, or repository-required conventions.

When a response mixes both kinds of content, localize only the human-facing prose and keep the fixed artifacts stable.
