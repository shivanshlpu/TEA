import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const businesses = await prisma.business.findMany();
  console.log('Businesses:', businesses);
  
  if (businesses.length === 0) {
    console.log('No businesses found. Please sign up first.');
    return;
  }
  
  const business = businesses[businesses.length - 1]; // get the latest one
  console.log(`Adding items to business: ${business.name} (${business.id})`);
  
  // Create Categories
  const catHot = await prisma.category.create({ data: { businessId: business.id, name: 'Hot Beverages', sortOrder: 1 } });
  const catCold = await prisma.category.create({ data: { businessId: business.id, name: 'Cold Beverages', sortOrder: 2 } });
  const catSnacks = await prisma.category.create({ data: { businessId: business.id, name: 'Snacks', sortOrder: 3 } });

  // Create Menu Items
  await prisma.menuItem.create({
    data: {
      businessId: business.id, categoryId: catHot.id,
      name: 'Classic Cappuccino', description: 'Rich espresso with steamed milk foam.',
      price: 150, isVeg: true, rating: 4.8
    }
  });
  
  await prisma.menuItem.create({
    data: {
      businessId: business.id, categoryId: catCold.id,
      name: 'Iced Latte', description: 'Chilled espresso and milk over ice.',
      price: 180, isVeg: true, rating: 4.5
    }
  });

  await prisma.menuItem.create({
    data: {
      businessId: business.id, categoryId: catSnacks.id,
      name: 'Grilled Cheese Sandwich', description: 'Crispy sourdough with melted cheddar.',
      price: 200, isVeg: true, rating: 4.7
    }
  });

  console.log('Test items added successfully!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
