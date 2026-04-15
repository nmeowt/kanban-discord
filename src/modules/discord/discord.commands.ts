export const DISCORD_COMMANDS = [
  {
    name: 'task',
    description: 'Task operations',
    subcommands: ['create', 'assign', 'move', 'approve', 'reject', 'list', 'view'],
  },
  {
    name: 'bug',
    description: 'Bug operations',
    subcommands: ['create'],
  },
  {
    name: 'board',
    description: 'Board operations',
    subcommands: ['view'],
  },
  {
    name: 'admin',
    description: 'Admin operations',
    subcommands: ['workflow', 'roles', 'settings'],
  },
];
