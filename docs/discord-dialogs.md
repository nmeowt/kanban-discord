# Discord Dialog Reference

## Create Task Dialog

- Trigger: `/task create` or `/bug create`
- Fields:
  - `title`
  - `description`
  - `priority`
  - `assignee`
  - `due_date`
  - `labels`
- Result:
  - creates a task in `Backlog`
  - assigns a specific user if provided
  - stores the deadline if provided
  - reminder jobs can notify later if the task is not `Done`

## Assign Task Dialog

- Trigger: `/task assign`
- Fields:
  - `task`
  - `assignee`
  - `note` optional
- Permission: `Lead`, `Admin`, or mapped bot permission that allows task assignment
- Result: creates assignment audit history and updates the current assignee

## Update Task Dialog

- Trigger: `/task update` or `/bug update`
- Fields:
  - `task`
  - `title`
  - `description`
  - `priority`
  - `assignee`
  - `labels`
  - `due_date`
- Result:
  - updates task metadata after creation
  - supports fixing wrong assignee, wrong priority, or wrong deadline

## Unassign Dialog

- Trigger: `/task unassign`
- Fields:
  - `task`
- Result:
  - clears the current assignee from the task

## Archive Dialog

- Trigger: `/task archive`
- Fields:
  - `task`
- Result:
  - archives the task
  - removes it from board and list views
  - keeps task history available in `/task view`

## Move Task Dialog

- Trigger: `/task move`
- Fields:
  - `task`
  - `to_state`
  - `reason` required for reopen or reject-style moves
- Result:
  - validates the workflow transition
  - updates task state
  - moving to `Done` marks the task completed and stops reminders

## Approval Dialog

- Trigger: `/task approve` or `/task reject`
- Fields:
  - `task`
  - `note` or `reason`
- Result:
  - records approval decision
  - moves task to `Approved` or `Reopened`

## Deadline Dialog

- Trigger: `/task deadline`
- Actions:
  - `set`
  - `clear`
- Fields:
  - `task`
  - `due_date`
- Result:
  - stores or clears task deadline
  - resets reminder state so future reminders can be sent correctly

## Admin Settings Dialog

- Trigger: `/admin settings`, `/admin workflow`, `/admin roles`
- Areas:
  - role-to-permission mapping
  - workflow state ordering
  - allowed transitions
  - notification channel
  - deadline reminder destination
