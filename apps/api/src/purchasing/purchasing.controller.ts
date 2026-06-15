import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { PurchaseOrdersService } from './purchase-orders.service';
import {
  CreatePurchaseOrderDto,
  CreateSupplierDto,
  ReceiveOrderDto,
  SubmitOrderDto,
  UpsertSupplierPartDto,
} from './purchasing.dto';
import { SuppliersService } from './suppliers.service';

@ApiTags('purchasing')
@ApiBearerAuth()
@Controller()
export class PurchasingController {
  constructor(
    private readonly suppliers: SuppliersService,
    private readonly orders: PurchaseOrdersService,
  ) {}

  // ── Suppliers ────────────────────────────────────────────
  @Get('suppliers')
  listSuppliers() {
    return this.suppliers.findAll();
  }

  @Get('suppliers/:id')
  getSupplier(@Param('id') id: string) {
    return this.suppliers.findOne(id);
  }

  @Roles('PURCHASING', 'WAREHOUSE_MANAGER')
  @Post('suppliers')
  createSupplier(@Body() dto: CreateSupplierDto) {
    return this.suppliers.create(dto);
  }

  @Roles('PURCHASING', 'WAREHOUSE_MANAGER')
  @Post('supplier-parts')
  upsertPart(@Body() dto: UpsertSupplierPartDto) {
    return this.suppliers.upsertPart(dto);
  }

  // ── Purchase orders ──────────────────────────────────────
  @Get('purchase-orders/:id')
  getOrder(@Param('id') id: string) {
    return this.orders.findOne(id);
  }

  @Roles('PURCHASING', 'WAREHOUSE_MANAGER')
  @Post('purchase-orders')
  createOrder(@Body() dto: CreatePurchaseOrderDto) {
    return this.orders.create(dto);
  }

  @Roles('PURCHASING', 'WAREHOUSE_MANAGER')
  @Post('purchase-orders/:id/submit')
  submitOrder(@Param('id') id: string, @Body() dto: SubmitOrderDto) {
    return this.orders.submit(id, dto);
  }

  @Roles('PURCHASING', 'WAREHOUSE_MANAGER', 'TECHNICIAN')
  @Post('purchase-orders/:id/receive')
  receiveOrder(
    @Param('id') id: string,
    @Body() dto: ReceiveOrderDto,
    @Req() req: { user?: { id: string } },
  ) {
    return this.orders.receive(id, dto, req.user?.id);
  }
}
