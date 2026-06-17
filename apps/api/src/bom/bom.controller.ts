import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { Roles } from '../auth/roles.decorator';
import { BomService } from './bom.service';
import { CreateBomDto, ImportCsvDto } from './bom.dto';

class VersionDto {
  @IsString() version: string;
}

@ApiTags('bom')
@ApiBearerAuth()
@Controller('boms')
export class BomController {
  constructor(private readonly bom: BomService) {}

  @Get()
  list() {
    return this.bom.findAll();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.bom.findOne(id);
  }

  @Roles('WAREHOUSE_MANAGER', 'TECHNICIAN', 'PURCHASING')
  @Post()
  create(@Body() dto: CreateBomDto) {
    return this.bom.create(dto);
  }

  @Roles('WAREHOUSE_MANAGER', 'TECHNICIAN', 'PURCHASING')
  @Post(':id/import-csv')
  importCsv(@Param('id') id: string, @Body() dto: ImportCsvDto) {
    return this.bom.importCsv(id, dto);
  }

  @Roles('WAREHOUSE_MANAGER', 'TECHNICIAN', 'PURCHASING')
  @Post(':id/version')
  version(@Param('id') id: string, @Body() dto: VersionDto) {
    return this.bom.createVersion(id, dto.version);
  }
}
