import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@coldstack.com';
  const password = 'password123';
  const name = 'Admin User';

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash,
      name,
    },
  });

  console.log(`✅ Seeded default user:
Email: ${user.email}
Password: ${password}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
