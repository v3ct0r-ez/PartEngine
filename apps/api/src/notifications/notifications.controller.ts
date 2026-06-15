import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { NotificationKind } from '@partengine/core';
import { Roles } from '../auth/roles.decorator';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@Query('unread') unread?: string, @Query('kind') kind?: NotificationKind) {
    return this.notifications.list({ unreadOnly: unread === 'true', kind });
  }

  @Roles('SUPER_ADMIN', 'WAREHOUSE_MANAGER')
  @Post('evaluate')
  evaluate() {
    return this.notifications.evaluateAll();
  }

  @Post(':id/read')
  markRead(@Param('id') id: string) {
    return this.notifications.markRead(id);
  }

  @Post('read-all')
  markAllRead() {
    return this.notifications.markAllRead();
  }
}
