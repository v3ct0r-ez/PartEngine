import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { CreateManufacturerDto } from './manufacturers.dto';
import { ManufacturersService } from './manufacturers.service';

@ApiTags('manufacturers')
@ApiBearerAuth()
@Controller('manufacturers')
export class ManufacturersController {
  constructor(private readonly manufacturers: ManufacturersService) {}

  @Get()
  list() {
    return this.manufacturers.list();
  }

  @Roles('WAREHOUSE_MANAGER', 'TECHNICIAN', 'PURCHASING')
  @Post()
  create(@Body() dto: CreateManufacturerDto) {
    return this.manufacturers.create(dto);
  }
}
