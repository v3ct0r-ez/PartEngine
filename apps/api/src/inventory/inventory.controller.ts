import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { WarehouseAccessService, type Actor } from '../auth/warehouse-access.service';
import {
  CreateLocationDto,
  CreateMovementDto,
  CreateWarehouseDto,
  ReservationDto,
  UpdateLocationDto,
  UpdateWarehouseDto,
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
  @Get('warehouses')
  listWarehouses() {
    return this.inventory.listWarehouses();
  }

  // ── Warehouse management (WAREHOUSE_MANAGER / SUPER_ADMIN) ─
  @Roles('WAREHOUSE_MANAGER')
  @Post('warehouses')
  createWarehouse(@Body() dto: CreateWarehouseDto) {
    return this.inventory.createWarehouse(dto);
  }

  @Roles('WAREHOUSE_MANAGER')
  @Patch('warehouses/:id')
  async updateWarehouse(@Param('id') id: string, @Body() dto: UpdateWarehouseDto, @Req() req: { user?: Actor }) {
    await this.access.assertCanWrite(req.user, id);
    return this.inventory.updateWarehouse(id, dto);
  }

  @Roles('WAREHOUSE_MANAGER')
  @Delete('warehouses/:id')
  async deleteWarehouse(@Param('id') id: string, @Req() req: { user?: Actor }) {
    await this.access.assertCanWrite(req.user, id);
    return this.inventory.deleteWarehouse(id);
  }

  @Get('movements')
  recentMovements(@Query('limit') limit?: string) {
    return this.inventory.recentMovements(limit ? Number(limit) : undefined);
  }

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

  @Roles('WAREHOUSE_MANAGER')
  @Patch('locations/:id')
  async updateLocation(@Param('id') id: string, @Body() dto: UpdateLocationDto, @Req() req: { user?: Actor }) {
    await this.access.assertCanWrite(req.user, await this.access.warehouseOfLocation(id));
    return this.locations.update(id, dto);
  }

  @Roles('WAREHOUSE_MANAGER')
  @Delete('locations/:id')
  async deleteLocation(@Param('id') id: string, @Req() req: { user?: Actor }) {
    await this.access.assertCanWrite(req.user, await this.access.warehouseOfLocation(id));
    return this.locations.remove(id);
  }
}
