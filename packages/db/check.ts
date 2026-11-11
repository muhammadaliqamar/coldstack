import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  console.log("Users in DB:", users.length);
  if (users.length > 0) {
    console.log(users.map(u => ({ email: u.email, name: u.name })));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
