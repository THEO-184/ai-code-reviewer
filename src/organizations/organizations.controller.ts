import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { CreateOrgDto } from './dto/create-org.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private readonly orgsService: OrganizationsService) {}

  @Post()
  create(@Body() dto: CreateOrgDto, @Request() req: any) {
    return this.orgsService.create(dto, req.user.id);
  }

  @Get('mine')
  getMyOrgs(@Request() req: any) {
    return this.orgsService.getMyOrgs(req.user.id);
  }

  @Post(':orgId/members')
  addMember(
    @Param('orgId') orgId: string,
    @Body() dto: AddMemberDto,
    @Request() req: any,
  ) {
    return this.orgsService.addMember(orgId, dto, req.user.id);
  }
}
