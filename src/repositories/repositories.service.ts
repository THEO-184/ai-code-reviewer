import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRepositoryDto } from './dto/create-repository.dto';
import { ListRepositoriesDto } from './dto/list-repositories.dto';
import { OrgRole } from '../generated/prisma/enums';

@Injectable()
export class RepositoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(orgId: string, dto: CreateRepositoryDto, userId: string) {
    await this.assertIsOrgMember(orgId, userId, [OrgRole.OWNER, OrgRole.ADMIN]);

    // Nested write: repository + its first chat session in one round-trip.
    // Prisma fills chatSession.repositoryId automatically from the parent.
    return this.prisma.repository.create({
      data: {
        name: dto.name,
        url: dto.url,
        orgId,
        chatSessions: {
          create: {},
        },
      },
      include: { chatSessions: true },
    });
  }

  async findAllForOrg(orgId: string, userId: string, query: ListRepositoriesDto) {
    await this.assertIsOrgMember(orgId, userId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = {
      orgId,
      ...(query.search && {
        name: { contains: query.search, mode: 'insensitive' as const },
      }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.repository.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { chatSessions: true } } },
      }),
      this.prisma.repository.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(orgId: string, repoId: string, userId: string) {
    await this.assertIsOrgMember(orgId, userId);

    const repo = await this.prisma.repository.findFirst({
      where: { id: repoId, orgId },
      include: { chatSessions: { orderBy: { createdAt: 'desc' } } },
    });

    if (!repo) throw new NotFoundException('Repository not found');
    return repo;
  }

  private async assertIsOrgMember(
    orgId: string,
    userId: string,
    allowedRoles?: OrgRole[],
  ) {
    const membership = await this.prisma.orgMember.findUnique({
      where: { userId_orgId: { userId, orgId } },
    });

    if (!membership) throw new NotFoundException('Organisation not found');

    if (allowedRoles && !allowedRoles.includes(membership.role)) {
      throw new ForbiddenException(
        `Requires one of: ${allowedRoles.join(', ')}`,
      );
    }
  }
}
