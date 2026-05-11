import { IsString, MinLength, Matches } from 'class-validator';

export class CreateOrgDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug must be lowercase letters, numbers, and hyphens only',
  })
  slug!: string;
}
