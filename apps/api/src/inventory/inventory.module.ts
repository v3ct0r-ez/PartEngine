import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { LocationsService } from './locations.service';

@Module({
  controllers: [InventoryController],
  providers: [InventoryService, LocationsService],
  exports: [InventoryService],
})
export class InventoryModule {}
