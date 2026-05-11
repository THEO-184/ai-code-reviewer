import { IsEmail, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { OrgRole } from '../../generated/prisma/enums';

export class AddMemberDto {
  @Transform(({ value }) => value.toLowerCase())
  @IsEmail()
  email!: string;

  @IsEnum(OrgRole)
  role!: OrgRole;
}
