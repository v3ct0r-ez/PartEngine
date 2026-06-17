import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { CreateManufacturerDto, UpdateManufacturerDto } from './manufacturers.dto';
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

  @Roles('WAREHOUSE_MANAGER', 'TECHNICIAN', 'PURCHASING')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateManufacturerDto) {
    return this.manufacturers.update(id, dto);
  }

  @Roles('WAREHOUSE_MANAGER')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.manufacturers.remove(id);
  }
}
