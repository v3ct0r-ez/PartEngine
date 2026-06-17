import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

/** Economic + stock-threshold fields shared by create/update. */
class EconomicFields {
  @IsOptional() @Type(() => Number) @IsNumber() minQty?: number;
  @IsOptional() @Type(() => Number) @IsNumber() maxQty?: number;
  @IsOptional() @Type(() => Number) @IsNumber() idealQty?: number;
  @IsOptional() @Type(() => Number) @IsNumber() avgPrice?: number;
  @IsOptional() @Type(() => Number) @IsNumber() lastPrice?: number;
  @IsOptional() @IsString() currency?: string;
}

export class CreateComponentDto extends EconomicFields {
  @IsString() internalCode: string;
  @IsString() name: string;
  @IsString() categoryId: string;

  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsArray() aliases?: string[];
  @IsOptional() @IsArray() tags?: string[];
  @IsOptional() @IsString() manufacturerId?: string;
  @IsOptional() @IsString() mpn?: string;
  @IsOptional() @IsString() footprint?: string;
  @IsOptional() @IsString() package?: string;

  /** Dynamic per-category technical parameters; validated against CategoryField. */
  @IsOptional() @IsObject() parameters?: Record<string, unknown>;

  /** Optional reason captured by the audit log. */
  @IsOptional() @IsString() _reason?: string;
}

export class UpdateComponentDto extends EconomicFields {
  @IsOptional() @IsString() internalCode?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsArray() aliases?: string[];
  @IsOptional() @IsArray() tags?: string[];
  @IsOptional() @IsString() manufacturerId?: string;
  @IsOptional() @IsString() mpn?: string;
  @IsOptional() @IsString() footprint?: string;
  @IsOptional() @IsString() package?: string;
  @IsOptional() @IsObject() parameters?: Record<string, unknown>;
  @IsOptional() @IsString() _reason?: string;
}

export class RangeFilterDto {
  @IsString() field: string;
  @IsOptional() from?: string | number;
  @IsOptional() to?: string | number;
}

export class SearchComponentsDto {
  @ApiPropertyOptional({ example: 'resistenza 10k 1% 0603' })
  @IsOptional() @IsString() q?: string;

  /** Explicit category filter (slug) from the filter sidebar. */
  @IsOptional() @IsString() categorySlug?: string;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => RangeFilterDto)
  ranges?: RangeFilterDto[];

  @IsOptional() @IsString() sortField?: string;
  @IsOptional() @IsString() sortDir?: 'asc' | 'desc';
  @IsOptional() @IsString() cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() limit?: number;
}
