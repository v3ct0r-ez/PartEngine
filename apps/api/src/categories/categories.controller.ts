import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import {
  CreateCategoryDto,
  FieldDto,
  ReorderFieldsDto,
  UpdateCategoryDto,
  UpdateFieldDto,
} from './categories.dto';
import { CategoriesService } from './categories.service';

@ApiTags('categories')
@ApiBearerAuth()
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  // Reads: any authenticated user (the dynamic form/filters need them).
  @Get()
  list() {
    return this.categories.list();
  }

  @Get(':idOrSlug')
  get(@Param('idOrSlug') idOrSlug: string) {
    return this.categories.get(idOrSlug);
  }

  // Writes: admins / warehouse managers.
  @Roles('SUPER_ADMIN', 'WAREHOUSE_MANAGER')
  @Post()
  create(@Body() dto: CreateCategoryDto) {
    return this.categories.create(dto);
  }

  @Roles('SUPER_ADMIN', 'WAREHOUSE_MANAGER')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categories.update(id, dto);
  }

  @Roles('SUPER_ADMIN', 'WAREHOUSE_MANAGER')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.categories.remove(id);
  }

  // ── Fields ───────────────────────────────────────────────
  @Roles('SUPER_ADMIN', 'WAREHOUSE_MANAGER')
  @Post(':id/fields')
  addField(@Param('id') id: string, @Body() dto: FieldDto) {
    return this.categories.addField(id, dto);
  }

  @Roles('SUPER_ADMIN', 'WAREHOUSE_MANAGER')
  @Patch(':id/fields/reorder')
  reorderFields(@Param('id') id: string, @Body() dto: ReorderFieldsDto) {
    return this.categories.reorderFields(id, dto.fieldIds);
  }

  @Roles('SUPER_ADMIN', 'WAREHOUSE_MANAGER')
  @Patch('fields/:fieldId')
  updateField(@Param('fieldId') fieldId: string, @Body() dto: UpdateFieldDto) {
    return this.categories.updateField(fieldId, dto);
  }

  @Roles('SUPER_ADMIN', 'WAREHOUSE_MANAGER')
  @Delete('fields/:fieldId')
  removeField(@Param('fieldId') fieldId: string) {
    return this.categories.removeField(fieldId);
  }
}
