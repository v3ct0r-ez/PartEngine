import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { WarehouseAccessService, type Actor } from '../auth/warehouse-access.service';
import {
  CreateLocationDto,
  CreateMovementDto,
  ReservationDto,
} from './inventory.dto';
import { InventoryService } from './inventory.service';
import { LocationsService } from './locations.service';

@ApiTags('inventory')
@ApiBearerAuth()
@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly inventory: InventoryService,
    private readonly locations: LocationsService,
    private readonly access: WarehouseAccessService,
  ) {}

  // ── Movements ────────────────────────────────────────────
  @Roles('WAREHOUSE_MANAGER', 'TECHNICIAN')
  @Post('movements')
  async createMovement(@Body() dto: CreateMovementDto, @Req() req: { user?: Actor }) {
    await this.access.assertMovementAccess(req.user, dto);
    return this.inventory.createMovement(dto, req.user?.id);
  }

  @Roles('WAREHOUSE_MANAGER', 'TECHNICIAN')
  @Post('reserve')
  async reserve(@Body() dto: ReservationDto, @Req() req: { user?: Actor }) {
    await this.access.assertCanWrite(req.user, await this.access.warehouseOfLocation(dto.locationId));
    return this.inventory.reserve(dto);
  }

  @Roles('WAREHOUSE_MANAGER', 'TECHNICIAN')
  @Post('release')
  async release(@Body() dto: ReservationDto, @Req() req: { user?: Actor }) {
    await this.access.assertCanWrite(req.user, await this.access.warehouseOfLocation(dto.locationId));
    return this.inventory.release(dto);
  }

  // ── Stock queries (read-only, any authenticated role) ────
  @Get('components/:id/stock')
  componentStock(@Param('id') id: string) {
    return this.inventory.componentStock(id);
  }

  @Get('components/:id/movements')
  movements(@Param('id') id: string, @Query('limit') limit?: string) {
    return this.inventory.movementHistory(id, limit ? Number(limit) : undefined);
  }

  // ── Locations ────────────────────────────────────────────
  @Roles('WAREHOUSE_MANAGER')
  @Post('locations')
  async createLocation(@Body() dto: CreateLocationDto, @Req() req: { user?: Actor }) {
    await this.access.assertCanWrite(req.user, dto.warehouseId);
    return this.locations.create(dto);
  }

  @Get('warehouses/:warehouseId/locations')
  locationTree(@Param('warehouseId') warehouseId: string) {
    return this.locations.tree(warehouseId);
  }
}
