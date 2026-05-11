import { IsEmail, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class LoginDto {
  @Transform(({ value }) => value.toLowerCase())
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}
