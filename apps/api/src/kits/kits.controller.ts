import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { WarehouseAccessService, type Actor } from '../auth/warehouse-access.service';
import { BuildKitDto, CreateKitDto } from './kits.dto';
import { KitsService } from './kits.service';

@ApiTags('kits')
@ApiBearerAuth()
@Controller('kits')
export class KitsController {
  constructor(
    private readonly kits: KitsService,
    private readonly access: WarehouseAccessService,
  ) {}

  @Get()
  list() {
    return this.kits.findAll();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.kits.findOne(id);
  }

  @Roles('WAREHOUSE_MANAGER', 'TECHNICIAN')
  @Post()
  create(@Body() dto: CreateKitDto) {
    return this.kits.create(dto);
  }

  @Roles('WAREHOUSE_MANAGER', 'TECHNICIAN')
  @Post(':id/build')
  async build(@Param('id') id: string, @Body() dto: BuildKitDto, @Req() req: { user?: Actor }) {
    await this.access.assertCanWrite(req.user, await this.access.warehouseOfLocation(dto.locationId));
    return this.kits.build(id, dto, req.user?.id);
  }
}
