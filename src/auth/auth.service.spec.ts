import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

// ─── Mock factory helpers ────────────────────────────────────────────────────
// These create fake objects that look like real services but do nothing by
// default. Each method is a jest.fn() — a spy we can control per test.

const mockUsersService = {
  create: jest.fn(),
  findByEmail: jest.fn(),
  findById: jest.fn(),
  updateRefreshToken: jest.fn(),
};

const mockJwtService = {
  signAsync: jest.fn(),
};

const mockConfigService = {
  getOrThrow: jest.fn(),
};

// ─── Test suite ──────────────────────────────────────────────────────────────
// describe() groups related tests. The string is just a label shown in output.

describe('AuthService', () => {
  let authService: AuthService;

  // beforeEach runs before every single test. We rebuild the module fresh each
  // time so one test's state never bleeds into another.
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  // After each test, clear all mock call history and return values so the
  // next test starts with a clean slate.
  afterEach(() => jest.clearAllMocks());

  // ─── register ──────────────────────────────────────────────────────────────
  describe('register', () => {
    it('should create a user and return access and refresh tokens', async () => {
      // ARRANGE — set up what the mocks will return when called
      const dto = {
        email: 'theo@test.com',
        name: 'Theo',
        password: 'password123',
      };
      const createdUser = { id: 'user-1', email: dto.email };

      mockUsersService.create.mockResolvedValue(createdUser);
      mockConfigService.getOrThrow.mockReturnValue('secret');
      mockJwtService.signAsync
        .mockResolvedValueOnce('access-token') // first call = access token
        .mockResolvedValueOnce('refresh-token'); // second call = refresh token
      mockUsersService.updateRefreshToken.mockResolvedValue(undefined);

      // ACT — call the method we're testing
      const result = await authService.register(dto);

      // ASSERT — verify the output and that the right things were called
      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      expect(mockUsersService.create).toHaveBeenCalledWith(dto);
      expect(mockUsersService.updateRefreshToken).toHaveBeenCalledWith(
        'user-1',
        expect.any(String),
      );
    });

    it('should store a bcrypt hash of the refresh token, not the raw token', async () => {
      // This test verifies a security requirement: we never store raw tokens.
      mockUsersService.create.mockResolvedValue({
        id: 'user-1',
        email: 'theo@test.com',
      });
      mockConfigService.getOrThrow.mockReturnValue('secret');
      mockJwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('raw-refresh-token');
      mockUsersService.updateRefreshToken.mockResolvedValue(undefined);

      await authService.register({
        email: 'theo@test.com',
        name: 'Theo',
        password: 'pass',
      });

      // The second argument to updateRefreshToken must NOT be the raw token
      const storedToken = mockUsersService.updateRefreshToken.mock.calls[0][1];
      expect(storedToken).not.toBe('raw-refresh-token');

      // And it must be a valid bcrypt hash of the raw token
      const isHash = await bcrypt.compare('raw-refresh-token', storedToken);
      expect(isHash).toBe(true);
    });
  });

  // ─── login ─────────────────────────────────────────────────────────────────
  describe('login', () => {
    it('should return tokens when credentials are valid', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      mockUsersService.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'theo@test.com',
        password: hashedPassword,
      });
      mockConfigService.getOrThrow.mockReturnValue('secret');
      mockJwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');
      mockUsersService.updateRefreshToken.mockResolvedValue(undefined);

      const result = await authService.login({
        email: 'theo@test.com',
        password: 'password123',
      });

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });

    it('should throw UnauthorizedException when email does not exist', async () => {
      // findByEmail returns null — user not found
      mockUsersService.findByEmail.mockResolvedValue(null);

      await expect(
        authService.login({ email: 'ghost@test.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when password is wrong', async () => {
      const hashedPassword = await bcrypt.hash('correct-password', 10);
      mockUsersService.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'theo@test.com',
        password: hashedPassword,
      });

      await expect(
        authService.login({
          email: 'theo@test.com',
          password: 'wrong-password',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─── logout ────────────────────────────────────────────────────────────────
  describe('logout', () => {
    it('should set refreshToken to null in the database', async () => {
      mockUsersService.updateRefreshToken.mockResolvedValue(undefined);

      await authService.logout('user-1');

      expect(mockUsersService.updateRefreshToken).toHaveBeenCalledWith(
        'user-1',
        null,
      );
    });
  });

  // ─── refreshTokens ─────────────────────────────────────────────────────────
  describe('refreshTokens', () => {
    it('should issue a new token pair and store a new hashed refresh token', async () => {
      mockConfigService.getOrThrow.mockReturnValue('secret');
      mockJwtService.signAsync
        .mockResolvedValueOnce('new-access-token')
        .mockResolvedValueOnce('new-refresh-token');
      mockUsersService.updateRefreshToken.mockResolvedValue(undefined);

      const result = await authService.refreshTokens('user-1', 'theo@test.com');

      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
      expect(mockUsersService.updateRefreshToken).toHaveBeenCalledWith(
        'user-1',
        expect.any(String),
      );
    });
  });
});
