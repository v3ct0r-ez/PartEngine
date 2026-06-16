import { IsOptional, IsString } from 'class-validator';

export class CreateManufacturerDto {
  @IsString() name: string;
  @IsOptional() @IsString() website?: string;
}
