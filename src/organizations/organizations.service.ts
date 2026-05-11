import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrgDto } from './dto/create-org.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { OrgRole } from '../generated/prisma/enums';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateOrgDto, userId: string) {
    const existing = await this.prisma.organization.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) throw new ConflictException('Slug already taken');

    // Transaction: create the org and make the creator OWNER atomically.
    // If either insert fails, both roll back — you never get an org with no owner.
    return this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: dto.name, slug: dto.slug },
      });

      await tx.orgMember.create({
        data: { userId, orgId: org.id, role: OrgRole.OWNER },
      });

      return org;
    });
  }

  async getMyOrgs(userId: string) {
    return this.prisma.orgMember.findMany({
      where: { userId },
      include: { organization: true },
    });
  }

  async addMember(orgId: string, dto: AddMemberDto, requesterId: string) {
    await this.assertCanManageMembers(orgId, requesterId);

    const targetUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!targetUser) throw new NotFoundException('User not found');

    const alreadyMember = await this.prisma.orgMember.findUnique({
      where: { userId_orgId: { userId: targetUser.id, orgId } },
    });
    if (alreadyMember) throw new ConflictException('User is already a member');

    return this.prisma.orgMember.create({
      data: { userId: targetUser.id, orgId, role: dto.role },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
  }

  private async assertCanManageMembers(orgId: string, userId: string) {
    const membership = await this.prisma.orgMember.findUnique({
      where: { userId_orgId: { userId, orgId } },
    });

    if (!membership) throw new NotFoundException('Organisation not found');

    if (membership.role === OrgRole.MEMBER) {
      throw new ForbiddenException('Only OWNER or ADMIN can manage members');
    }
  }
}
