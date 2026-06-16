import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InventoryModule } from '../inventory/inventory.module';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PurchasingController } from './purchasing.controller';
import { SuppliersService } from './suppliers.service';

@Module({
  imports: [InventoryModule, AuthModule], // tx InventoryService + per-warehouse access
  controllers: [PurchasingController],
  providers: [SuppliersService, PurchaseOrdersService],
  exports: [SuppliersService, PurchaseOrdersService],
})
export class PurchasingModule {}
