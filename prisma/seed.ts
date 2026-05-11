import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Wipe in dependency order so foreign key constraints don't complain.
  // deleteMany with no `where` = truncate the table.
  await prisma.message.deleteMany();
  await prisma.chatSession.deleteMany();
  await prisma.repository.deleteMany();
  await prisma.orgMember.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();

  const password = await bcrypt.hash('password123', 12);

  // Create two users
  const alice = await prisma.user.create({
    data: { email: 'alice@example.com', name: 'Alice', password },
  });

  const bob = await prisma.user.create({
    data: { email: 'bob@example.com', name: 'Bob', password },
  });

  // Create an org — Alice is OWNER, Bob is MEMBER
  const org = await prisma.organization.create({
    data: {
      name: 'Acme Corp',
      slug: 'acme-corp',
      members: {
        // Nested write: create both memberships in one query
        create: [
          { userId: alice.id, role: 'OWNER' },
          { userId: bob.id, role: 'MEMBER' },
        ],
      },
    },
  });

  // Create a repository with a chat session and two seed messages
  await prisma.repository.create({
    data: {
      name: 'backend-api',
      url: 'https://github.com/acme-corp/backend-api',
      orgId: org.id,
      chatSessions: {
        create: {
          messages: {
            create: [
              { role: 'USER', content: 'What does the auth module do?' },
              {
                role: 'ASSISTANT',
                content:
                  'The auth module handles JWT-based authentication with access and refresh token rotation.',
              },
            ],
          },
        },
      },
    },
  });

  console.log('Seed complete');
  console.log(`  alice@example.com / password123  (OWNER)`);
  console.log(`  bob@example.com   / password123  (MEMBER)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
