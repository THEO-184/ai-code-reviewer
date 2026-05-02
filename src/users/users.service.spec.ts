import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

// We mock PrismaService at the model level.
// prisma.user.findUnique, prisma.user.create etc. are all spies.
const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

describe('UsersService', () => {
  let usersService: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    usersService = module.get<UsersService>(UsersService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── create ────────────────────────────────────────────────────────────────
  describe('create', () => {
    it('should hash the password before saving to the database', async () => {
      const dto = {
        email: 'theo@test.com',
        name: 'Theo',
        password: 'plaintext',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null); // no existing user
      mockPrismaService.user.create.mockResolvedValue({
        id: 'user-1',
        email: dto.email,
        name: dto.name,
        password: 'hashed',
        refreshToken: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await usersService.create(dto);

      // The password passed to prisma.user.create must NOT be the plain text
      const savedPassword =
        mockPrismaService.user.create.mock.calls[0][0].data.password;
      expect(savedPassword).not.toBe('plaintext');

      // It must be a valid bcrypt hash of the original password
      const isValidHash = await bcrypt.compare('plaintext', savedPassword);
      expect(isValidHash).toBe(true);
    });

    it('should return the user without the password field', async () => {
      const dto = {
        email: 'theo@test.com',
        name: 'Theo',
        password: 'plaintext',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({
        id: 'user-1',
        email: dto.email,
        name: dto.name,
        password: 'hashed-password',
        refreshToken: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await usersService.create(dto);

      // password must be stripped from the returned object
      expect(result).not.toHaveProperty('password');
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('email', dto.email);
    });

    it('should throw ConflictException when email is already registered', async () => {
      // findUnique returns an existing user — email is taken
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'existing-user',
        email: 'theo@test.com',
      });

      await expect(
        usersService.create({
          email: 'theo@test.com',
          name: 'Theo',
          password: 'pass',
        }),
      ).rejects.toThrow(ConflictException);

      // Crucially — prisma.user.create must never be called when email exists
      expect(mockPrismaService.user.create).not.toHaveBeenCalled();
    });
  });

  // ─── findByEmail ───────────────────────────────────────────────────────────
  describe('findByEmail', () => {
    it('should return the full user record including password', async () => {
      const user = { id: 'user-1', email: 'theo@test.com', password: 'hashed' };
      mockPrismaService.user.findUnique.mockResolvedValue(user);

      const result = await usersService.findByEmail('theo@test.com');

      // findByEmail is used internally for password comparison — it MUST include password
      expect(result).toHaveProperty('password');
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'theo@test.com' },
      });
    });
  });

  // ─── findById ──────────────────────────────────────────────────────────────
  describe('findById', () => {
    it('should return the user without the password field', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'theo@test.com',
        password: 'hashed',
        refreshToken: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await usersService.findById('user-1');

      expect(result).not.toHaveProperty('password');
    });

    it('should return null when user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await usersService.findById('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  // ─── updateRefreshToken ────────────────────────────────────────────────────
  describe('updateRefreshToken', () => {
    it('should call prisma.user.update with the correct userId and token', async () => {
      mockPrismaService.user.update.mockResolvedValue({});

      await usersService.updateRefreshToken('user-1', 'hashed-token');

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { refreshToken: 'hashed-token' },
      });
    });

    it('should accept null to clear the refresh token on logout', async () => {
      mockPrismaService.user.update.mockResolvedValue({});

      await usersService.updateRefreshToken('user-1', null);

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { refreshToken: null },
      });
    });
  });
});
