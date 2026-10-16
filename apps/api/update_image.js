import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.menuItem.updateMany({
    where: { name: 'Tandoori Paneer Sandwich' },
    data: { imageUrl: '/uploads/tandoori_paneer_sandwich.jpg' }
  });

  await prisma.menuItem.updateMany({
    where: { name: 'Tandoori Paneer 2X Layer' },
    data: { imageUrl: '/uploads/tandoori_paneer_2x_layer.jpg' }
  });

  console.log("Updated images successfully!");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
