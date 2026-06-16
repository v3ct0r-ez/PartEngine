import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class CreateComponentDto {
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

export class UpdateComponentDto {
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

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => RangeFilterDto)
  ranges?: RangeFilterDto[];

  @IsOptional() @IsString() sortField?: string;
  @IsOptional() @IsString() sortDir?: 'asc' | 'desc';
  @IsOptional() @IsString() cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() limit?: number;
}
