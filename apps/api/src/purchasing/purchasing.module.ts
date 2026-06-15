import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PurchasingController } from './purchasing.controller';
import { SuppliersService } from './suppliers.service';

@Module({
  imports: [InventoryModule], // reuse the transactional InventoryService for receiving
  controllers: [PurchasingController],
  providers: [SuppliersService, PurchaseOrdersService],
  exports: [SuppliersService, PurchaseOrdersService],
})
export class PurchasingModule {}
