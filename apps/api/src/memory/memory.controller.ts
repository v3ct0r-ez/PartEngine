import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';
import { MemoryService } from './memory.service';

type Actor = { id: string };

class UpdatePreferencesDto {
  @IsOptional() @IsString() theme?: string;
  @IsOptional() @IsString() language?: string;
  @IsOptional() @IsObject() uiState?: Record<string, unknown>;
}
class CreateViewDto {
  @IsString() name: string;
  @IsString() scope: string;
  @IsOptional() @IsObject() config?: Record<string, unknown>;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}
class UpdateViewDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsObject() config?: Record<string, unknown>;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}
class RecentDto {
  @IsString() kind: string;
  @IsOptional() @IsString() refId?: string;
  @IsString() label: string;
}

/** Persistent "user memory": preferences, saved views and recent items.
 *  All endpoints operate on the authenticated user (req.user.id). */
@ApiTags('memory')
@ApiBearerAuth()
@Controller('me')
export class MemoryController {
  constructor(private readonly memory: MemoryService) {}

  @Get('preferences')
  getPreferences(@Req() req: { user: Actor }) {
    return this.memory.getPreferences(req.user.id);
  }

  @Put('preferences')
  updatePreferences(@Body() dto: UpdatePreferencesDto, @Req() req: { user: Actor }) {
    return this.memory.updatePreferences(req.user.id, dto);
  }

  @Get('views')
  listViews(@Query('scope') scope: string | undefined, @Req() req: { user: Actor }) {
    return this.memory.listViews(req.user.id, scope);
  }

  @Post('views')
  createView(@Body() dto: CreateViewDto, @Req() req: { user: Actor }) {
    return this.memory.createView(req.user.id, dto);
  }

  @Patch('views/:id')
  updateView(@Param('id') id: string, @Body() dto: UpdateViewDto, @Req() req: { user: Actor }) {
    return this.memory.updateView(req.user.id, id, dto);
  }

  @Delete('views/:id')
  deleteView(@Param('id') id: string, @Req() req: { user: Actor }) {
    return this.memory.deleteView(req.user.id, id);
  }

  @Get('recent')
  listRecent(
    @Query('kind') kind: string | undefined,
    @Query('limit') limit: string | undefined,
    @Req() req: { user: Actor },
  ) {
    return this.memory.listRecent(req.user.id, kind, limit ? Number(limit) : undefined);
  }

  @Post('recent')
  recordRecent(@Body() dto: RecentDto, @Req() req: { user: Actor }) {
    return this.memory.recordRecent(req.user.id, dto);
  }
}
