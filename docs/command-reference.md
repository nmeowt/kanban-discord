# Command Reference

## Task

- `/task create title:"..." description:"..." priority:HIGH assignee:@user due_date:2026-04-20`
- `/task update task:"Task title from autocomplete" title:"..." description:"..." priority:HIGH assignee:@user labels:"backend,api" due_date:2026-04-22`
- `/task assign task:"Task title from autocomplete" assignee:@user note:"..."`
- `/task unassign task:"Task title from autocomplete"`
- `/task archive task:"Task title from autocomplete"`
- `/task move task:"Task title from autocomplete" to_state:in_progress reason:"..."`
- `/task approve task:"Task title from autocomplete" note:"..."`
- `/task reject task:"Task title from autocomplete" reason:"..."`
- `/task list state:testing`
- `/task my`
- `/task due_today`
- `/task overdue`
- `/task deadline action:set task:"Task title from autocomplete" due_date:2026-04-20`
- `/task deadline action:clear task:"Task title from autocomplete"`
- `/task view task:"Task title from autocomplete"`

## Bug

- `/bug create title:"..." description:"..." priority:CRITICAL assignee:@user due_date:2026-04-20`
- `/bug update task:"Bug title from autocomplete" title:"..." description:"..." priority:HIGH assignee:@user labels:"bug,urgent" due_date:2026-04-21`

## Board

- `/board view`

## Workflow

- `/workflow view`

## Admin

- `/admin workflow`
- `/admin roles action:view`
- `/admin roles action:set discord_role:@Lead app_role:LEAD`
- `/admin roles action:remove discord_role:@Lead app_role:LEAD`
- `/admin settings action:view`
- `/admin settings action:set_notification_channel notification_channel:#kanban-bot`
- `/admin settings action:clear_notification_channel`
