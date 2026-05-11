import { IsString, IsUrl, MinLength } from 'class-validator';

export class CreateRepositoryDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsUrl()
  url!: string;
}
