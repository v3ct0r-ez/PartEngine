import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export const FIELD_TYPES = [
  'STRING',
  'TEXT',
  'NUMBER',
  'QUANTITY',
  'BOOLEAN',
  'ENUM',
  'DATE',
] as const;

export class CreateCategoryDto {
  @Matches(/^[a-z0-9_]+$/, { message: 'slug: only lowercase letters, digits and _' })
  slug: string;
  @IsString() name: string;
  @IsOptional() @IsString() icon?: string;
  @IsOptional() @IsString() parentId?: string;
  @IsOptional() @IsBoolean() isGroup?: boolean;
  @IsOptional() @IsString() codePrefix?: string;
}

export class UpdateCategoryDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() icon?: string;
  @IsOptional() @IsString() codePrefix?: string;
  @IsOptional() @IsString() parentId?: string;
}

export class FieldDto {
  @Matches(/^[a-zA-Z0-9_]+$/, { message: 'key: letters, digits and _ only' })
  key: string;
  @IsString() label: string;
  @IsIn(FIELD_TYPES) type: (typeof FIELD_TYPES)[number];
  @IsOptional() @IsString() unit?: string;
  /** Allowed values for ENUM. */
  @IsOptional() @IsArray() options?: string[];
  @IsOptional() @IsBoolean() required?: boolean;
  /** { min, max, regex, step } */
  @IsOptional() @IsObject() validation?: Record<string, unknown>;
  @IsOptional() @IsBoolean() isFilterable?: boolean;
  @IsOptional() @IsBoolean() isSortable?: boolean;
  @IsOptional() @Type(() => Number) sortOrder?: number;
}

export class UpdateFieldDto {
  @IsOptional() @IsString() label?: string;
  @IsOptional() @IsIn(FIELD_TYPES) type?: (typeof FIELD_TYPES)[number];
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsArray() options?: string[];
  @IsOptional() @IsBoolean() required?: boolean;
  @IsOptional() @IsObject() validation?: Record<string, unknown>;
  @IsOptional() @IsBoolean() isFilterable?: boolean;
  @IsOptional() @IsBoolean() isSortable?: boolean;
  @IsOptional() @Type(() => Number) sortOrder?: number;
}

export class ReorderFieldsDto {
  /** Field ids in the desired display order. */
  @IsArray() @IsString({ each: true }) fieldIds: string[];
}
