import { Module } from '@nestjs/common';
import { TasksModule } from '../tasks/tasks.module';
import { DiscordService } from './discord.service';

@Module({
  imports: [TasksModule],
  providers: [DiscordService],
})
export class DiscordModule {}
