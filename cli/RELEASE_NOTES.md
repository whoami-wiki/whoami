Task queue system for managing wiki work items.

Features:
- `wai task create -m "description"` creates task pages in the `Task:` namespace with auto-incrementing IDs
- `wai task list` shows pending tasks (filter with `--status`)
- `wai task read <id>` displays task details
- `wai task claim <id>` marks a task as in-progress
- `wai task complete <id> -m "output"` and `wai task fail <id> -m "reason"` for completing the lifecycle
- `wai task requeue <id>` moves failed or in-progress tasks back to pending
- Tasks link to sources via `--source` flag and are categorized by status
