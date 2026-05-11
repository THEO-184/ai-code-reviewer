import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { RepositoriesService } from './repositories.service';
import { CreateRepositoryDto } from './dto/create-repository.dto';
import { ListRepositoriesDto } from './dto/list-repositories.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('organizations/:orgId/repositories')
@UseGuards(JwtAuthGuard)
export class RepositoriesController {
  constructor(private readonly reposService: RepositoriesService) {}

  @Post()
  create(
    @Param('orgId') orgId: string,
    @Body() dto: CreateRepositoryDto,
    @Request() req: any,
  ) {
    return this.reposService.create(orgId, dto, req.user.id);
  }

  @Get()
  findAll(
    @Param('orgId') orgId: string,
    @Query() query: ListRepositoriesDto,
    @Request() req: any,
  ) {
    return this.reposService.findAllForOrg(orgId, req.user.id, query);
  }

  @Get(':repoId')
  findOne(
    @Param('orgId') orgId: string,
    @Param('repoId') repoId: string,
    @Request() req: any,
  ) {
    return this.reposService.findOne(orgId, repoId, req.user.id);
  }
}
