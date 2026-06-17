import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import type { Response } from 'express';
import { Roles } from '../auth/roles.decorator';
import { AttachmentsService, type UploadedFile as PeFile } from './attachments.service';

class OcrTextDto {
  @IsString() text: string;
}

@ApiTags('attachments')
@ApiBearerAuth()
@Controller()
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Get('components/:id/attachments')
  list(@Param('id') id: string) {
    return this.attachments.list(id);
  }

  @Roles('WAREHOUSE_MANAGER', 'TECHNICIAN')
  @Post('components/:id/attachments')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  upload(@Param('id') id: string, @UploadedFile() file?: PeFile) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.attachments.upload(id, file);
  }

  @Get('attachments/:id/download')
  async download(@Param('id') id: string, @Res() res: Response) {
    const { att, buffer } = await this.attachments.getForDownload(id);
    res.setHeader('Content-Type', att.contentType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(att.fileName)}"`);
    res.send(buffer);
  }

  @Roles('WAREHOUSE_MANAGER', 'TECHNICIAN')
  @Delete('attachments/:id')
  remove(@Param('id') id: string) {
    return this.attachments.remove(id);
  }

  @Roles('WAREHOUSE_MANAGER', 'TECHNICIAN')
  @Post('attachments/:id/ocr-text')
  setOcrText(@Param('id') id: string, @Body() dto: OcrTextDto) {
    return this.attachments.setOcrText(id, dto.text);
  }

  @Get('attachments/:id/suggest-fields')
  suggest(@Param('id') id: string) {
    return this.attachments.suggestFields(id);
  }
}
