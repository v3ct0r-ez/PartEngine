import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Role } from '@prisma/client';
import { IsBoolean, IsEmail, IsIn, IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { Public, Roles } from './roles.decorator';

const ROLES: Role[] = ['SUPER_ADMIN', 'WAREHOUSE_MANAGER', 'TECHNICIAN', 'PURCHASING', 'VIEWER'];

class LoginDto {
  @IsEmail() email: string;
  @IsString() @MinLength(8) password: string;
}

class RefreshDto {
  @IsString() refreshToken: string;
}

class SetupDto {
  @IsEmail() email: string;
  @IsString() fullName: string;
  @IsString() @MinLength(8) password: string;
}

class CreateUserDto {
  @IsEmail() email: string;
  @IsString() fullName: string;
  @IsString() @MinLength(8) password: string;
  @IsIn(ROLES) role: Role;
}

class GrantAccessDto {
  @IsString() userId: string;
  @IsString() warehouseId: string;
  @IsBoolean() canWrite: boolean;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** First-run state: does the app still need an initial admin? */
  @Public()
  @Get('status')
  async status() {
    return { needsSetup: await this.auth.needsSetup() };
  }

  /** Create the first administrator (only when no user exists). */
  @Public()
  @Post('setup')
  setup(@Body() dto: SetupDto) {
    return this.auth.setup(dto);
  }

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  logout(@Body() dto: RefreshDto) {
    return this.auth.logout(dto.refreshToken);
  }

  /** Current authenticated user (from the JWT). */
  @Get('me')
  me(@Req() req: { user?: unknown }) {
    return req.user;
  }

  // ── Admin: users & per-warehouse access ──────────────────
  @Roles('SUPER_ADMIN')
  @Get('users')
  listUsers() {
    return this.auth.listUsers();
  }

  @Roles('SUPER_ADMIN')
  @Post('users')
  createUser(@Body() dto: CreateUserDto) {
    return this.auth.createUser(dto);
  }

  @Roles('SUPER_ADMIN')
  @Post('warehouse-access')
  grantAccess(@Body() dto: GrantAccessDto) {
    return this.auth.grantWarehouseAccess(dto);
  }
}
