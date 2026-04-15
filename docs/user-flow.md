# User Flow

This document explains how server admins and team members use the bot in practice.

## Admin setup flow

```mermaid
flowchart TD
    A["Server owner or server admin"] --> B["Start bot"]
    B --> C["/admin roles action:View mappings"]
    C --> D["Map Discord server roles to bot permission roles"]
    D --> D1["Lead -> LEAD"]
    D --> D2["Developer -> DEVELOPER"]
    D --> D3["Tester -> TESTER"]
    D --> D4["Approver -> APPROVER"]
    D --> D5["Admin -> ADMIN"]
    D --> E["/admin settings action:View settings"]
    E --> F["Optional: set notification channel"]
    F --> G["Bot is ready for the team"]
```

## Team usage flow

```mermaid
flowchart TD
    A["Lead or permitted member"] --> B["/task create or /bug create"]
    B --> C["Task saved in database"]
    C --> D["Optional: assign to a specific user"]
    D --> E["/task assign task:'Task title' assignee:@user"]
    E --> F["Optional: correct metadata later"]
    F --> G["/task update or /bug update"]
    G --> H["Optional: remove wrong assignee"]
    H --> I["/task unassign"]
    I --> J["Assigned user works on task"]
    J --> K["/task move to_state:in_progress"]
    K --> L["/task move to_state:fixed"]
    L --> M["Tester moves to testing"]
    M --> N["/task move to_state:testing"]
    N --> O{"Approved?"}
    O -->|Yes| P["/task approve"]
    P --> Q["Task goes to Approved"]
    Q --> R["Optional final move to Done"]
    O -->|No| S["/task reject reason:..."]
    S --> T["Task returns to Reopened"]
```

## Deadline and reminder flow

```mermaid
flowchart TD
    A["Lead or permitted member"] --> B["Create task with due date or set it later with /task deadline"]
    B --> C["Task remains active"]
    C --> D{"Moved to Done?"}
    D -->|Yes| E["Mark completed and stop reminders"]
    D -->|No| F{"Within 24 hours of deadline?"}
    F -->|Yes| G["Reminder job sends due soon message"]
    F -->|No| H{"Past deadline?"}
    H -->|Yes| I["Reminder job sends overdue message"]
    H -->|No| J["Wait for next scheduled check"]
    G --> K["Assignee and notification channel can be alerted"]
    I --> K
```

## Board usage flow

```mermaid
flowchart TD
    A["Any team member"] --> B["/board view"]
    B --> C["Bot loads all tasks for the guild"]
    C --> D["Bot groups tasks by workflow state"]
    D --> E["Backlog"]
    D --> F["Todo"]
    D --> G["In Progress"]
    D --> H["Fixed"]
    D --> I["Testing"]
    D --> J["Approved"]
    D --> K["Done"]
    D --> L["Reopened"]
```

## Permission model

```mermaid
flowchart TD
    A["Discord server role"] --> B["Mapped by /admin roles"]
    B --> C["Bot permission role"]
    C --> D["User can access command"]

    C --> E["ADMIN"]
    C --> F["LEAD"]
    C --> G["DEVELOPER"]
    C --> H["TESTER"]
    C --> I["APPROVER"]
```

## Practical examples

### 1. Map a role

```text
/admin roles action:Map role to permission discord_role:@Lead app_role:LEAD
```

### 2. Create a task with a deadline

```text
/task create title:"Build auth" description:"Implement login" priority:HIGH assignee:@alice due_date:2026-04-20
```

### 3. Assign a task to a user

```text
/task assign task:"Build auth" assignee:@alice
```

### 4. Fix or update a task

```text
/task update task:"Build auth" title:"Build auth v2" assignee:@bob due_date:2026-04-22
/task unassign task:"Build auth"
```

### 5. Move a task

```text
/task move task:"Build auth" to_state:in_progress
```

### 6. Archive finished or obsolete work

```text
/task archive task:"Build auth"
```

### 7. Check urgent work

```text
/task my
/task due_today
/task overdue
/board view
```
