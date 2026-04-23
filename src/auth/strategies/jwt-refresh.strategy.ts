import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { UsersService } from '../../users/users.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.getOrThrow('JWT_REFRESH_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: { sub: string }) {
    const refreshToken = req.headers.authorization?.replace('Bearer ', '');
    if (!refreshToken) throw new UnauthorizedException();

    const user = await this.usersService.findById(payload.sub);
    // We need the raw user with refreshToken for comparison
    const rawUser = await this.usersService.findByEmail(user!.email);
    if (!rawUser?.refreshToken) throw new UnauthorizedException();

    const tokenMatches = await bcrypt.compare(refreshToken, rawUser.refreshToken);
    if (!tokenMatches) throw new UnauthorizedException();

    return user;
  }
}
