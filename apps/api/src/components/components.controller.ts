import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import {
  CreateComponentDto,
  SearchComponentsDto,
  UpdateComponentDto,
} from './components.dto';
import { ComponentsService } from './components.service';

@ApiTags('components')
@ApiBearerAuth()
@Controller('components')
export class ComponentsController {
  constructor(private readonly components: ComponentsService) {}

  // Read access for everyone authenticated (VIEWER included).
  @Get('search')
  search(@Query() dto: SearchComponentsDto) {
    return this.components.search(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.components.findOne(id);
  }

  @Roles('WAREHOUSE_MANAGER', 'TECHNICIAN')
  @Post()
  create(@Body() dto: CreateComponentDto, @Req() req: { user?: { id: string } }) {
    return this.components.create(dto, req.user?.id);
  }

  @Roles('WAREHOUSE_MANAGER', 'TECHNICIAN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateComponentDto) {
    return this.components.update(id, dto);
  }

  @Roles('WAREHOUSE_MANAGER')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.components.remove(id);
  }
}
