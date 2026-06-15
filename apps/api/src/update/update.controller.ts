import { Controller, Get, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { UpdateService } from './update.service';

@ApiTags('updates')
@ApiBearerAuth()
@Controller('updates')
export class UpdateController {
  constructor(private readonly updates: UpdateService) {}

  /** Cached current/latest version + whether an update is available. */
  @Get('status')
  status() {
    return this.updates.getStatus();
  }

  /** Force a fresh check against GitHub Releases. */
  @Roles('SUPER_ADMIN', 'WAREHOUSE_MANAGER')
  @Get('check')
  check() {
    return this.updates.check();
  }

  /** Apply the available update (SUPER_ADMIN only; requires UPDATE_ALLOW_APPLY). */
  @Roles('SUPER_ADMIN')
  @Post('apply')
  apply(@Req() req: { user?: { id: string } }) {
    return this.updates.apply(req.user?.id);
  }
}
