// ── Comprehensive CafeOS Seed Script ──
// Wipes existing data and seeds a fully operational database for testing.

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function clearDatabase() {
  console.log('🗑️  Wiping database clean...');
  await prisma.deliveryTracking.deleteMany({});
  await prisma.orderStatusLog.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.review.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.referral.deleteMany({});
  await prisma.coupon.deleteMany({});
  await prisma.inventoryItem.deleteMany({});
  await prisma.employee.deleteMany({});
  await prisma.customer.deleteMany({});
  await prisma.addOn.deleteMany({});
  await prisma.menuItem.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.business.deleteMany({});
  console.log('✅ Database wiped!');
}

async function main() {
  await clearDatabase();
  console.log('\n🌱 Seeding comprehensive CafeOS database...\n');

  const business = await prisma.business.create({
    data: {
      name: 'Tea Bhatti', // Used the name from the menu!
      industryType: 'cafe',
      address: 'Near Medical College, Shahdol, Madhya Pradesh',
      gstNumber: '29AABCU9603R1ZM',
      openingTime: '08:00',
      closingTime: '22:00',
      deliveryRadiusKm: 0,
      minOrderAmount: 0,
      packingCharge: 0,
      deliveryCharge: 0,
      upiId: 'teabhatti@upi',
      phoneNumber: '+919009149694',
      whatsappNumber: '+919009149694',
    },
  });
  console.log(`✅ Business: ${business.name} (${business.id})`);

  const ownerHash = await bcrypt.hash(process.env.SEED_OWNER_PASSWORD || 'ChangeMeOnFirstLogin!#123', 10);
  const ownerUser = await prisma.user.create({
    data: {
      businessId: business.id, role: 'owner', name: 'Store Owner',
      phone: process.env.SEED_OWNER_PHONE || '+919009149694', email: 'owner@cafedream.in', passwordHash: ownerHash,
    },
  });

  const customerHash = await bcrypt.hash(process.env.SEED_CUSTOMER_PASSWORD || 'ChangeMeCustomer!#123', 10);
  const customerUser = await prisma.user.create({
    data: {
      role: 'customer', name: 'Rahul Verma',
      phone: '+919111111111', email: 'rahul@example.com', passwordHash: customerHash,
    },
  });

  await prisma.customer.create({
    data: {
      userId: customerUser.id,
      businessId: business.id,
      referralCode: 'REFRAHUL1',
    },
  });

  await prisma.inventoryItem.createMany({
    data: [
      { businessId: business.id, name: 'Burger Buns', unit: 'pcs', currentStock: 50, lowStockAt: 20 },
      { businessId: business.id, name: 'Cheese Slices', unit: 'pcs', currentStock: 40, lowStockAt: 15 },
      { businessId: business.id, name: 'Pizza Base 8"', unit: 'pcs', currentStock: 30, lowStockAt: 10 },
    ]
  });

  // ── Categories ──
  const catBurger = await prisma.category.create({ data: { businessId: business.id, name: 'BURGERRR', sortOrder: 1 } });
  const catVadaPav = await prisma.category.create({ data: { businessId: business.id, name: 'VADA PAV', sortOrder: 2 } });
  const catSandwich = await prisma.category.create({ data: { businessId: business.id, name: 'SANDWICH', sortOrder: 3 } });
  const catMaggie = await prisma.category.create({ data: { businessId: business.id, name: 'MAGGIE', sortOrder: 4 } });
  const catPizza = await prisma.category.create({ data: { businessId: business.id, name: 'PIZZAAAH', sortOrder: 5 } });
  const catPasta = await prisma.category.create({ data: { businessId: business.id, name: 'PAAAASTA', sortOrder: 6 } });
  const catFries = await prisma.category.create({ data: { businessId: business.id, name: 'FRENCH FRIES', sortOrder: 7 } });
  const catCombos = await prisma.category.create({ data: { businessId: business.id, name: 'COMBOS', sortOrder: 8 } });

  // ── Menu Items ──
  const menuData = [
    // Burgers
    { categoryId: catBurger.id, name: 'Veggie Aloo Patty', price: 49, imageUrl: '/uploads/veggie_aloo_patty.png' },
    { categoryId: catBurger.id, name: 'Veg. Double Aloo Patty', price: 79, imageUrl: '/uploads/veg_double_aloo_patty.png' },
    { categoryId: catBurger.id, name: 'Veggie Cheese Burger', price: 69, imageUrl: '/uploads/veggie_cheese_burger.png' },
    { categoryId: catBurger.id, name: 'Veggie Paneer Cheese', price: 89, imageUrl: '/uploads/veggie_paneer_cheese.jpg' },
    { categoryId: catBurger.id, name: 'Tandoori Panner Burger', price: 89, imageUrl: '/uploads/veggie_paneer_cheese.png' },
    { categoryId: catBurger.id, name: 'Veg. Double Patty & Cheese', price: 99, imageUrl: '/uploads/veg_double_patty_cheese.png' },
    { categoryId: catBurger.id, name: 'Tea Bhatti Sp. King Burger', price: 129, imageUrl: '/uploads/tea_bhatti_sp_king_burger.png' },
    // Vada Pav
    { categoryId: catVadaPav.id, name: 'Butter Vadapav', price: 25, imageUrl: '/uploads/butter_vadapav.png' },
    { categoryId: catVadaPav.id, name: 'Cheese Butter Vadapav', price: 35, imageUrl: '/uploads/cheese_butter_vadapav.png' },
    { categoryId: catVadaPav.id, name: 'Tandoori Vadapav', price: 35, imageUrl: '/uploads/tandoori_vadapav.png' },
    // Sandwich
    { categoryId: catSandwich.id, name: 'Veggie Sandwich', price: 49, imageUrl: '/uploads/veggie_sandwich.png' },
    { categoryId: catSandwich.id, name: 'Cheese Corn Sandwich', price: 69, imageUrl: '/uploads/cheese_corn_sandwich.png' },
    { categoryId: catSandwich.id, name: 'Tandoori Paneer Sandwich', price: 79, imageUrl: '/uploads/tandoori_paneer_sandwich.jpg' },
    { categoryId: catSandwich.id, name: 'Tandoori Paneer 2X Layer', price: 99, imageUrl: '/uploads/tandoori_paneer_2x_layer.jpg' },
    { categoryId: catSandwich.id, name: 'Tea Bhatti Special', price: 129, imageUrl: '/uploads/tea_bhatti_special.png' },
    // Maggie
    { categoryId: catMaggie.id, name: 'Plain Maggie', price: 30, imageUrl: '/uploads/plain_maggie.png' },
    { categoryId: catMaggie.id, name: 'Veggie Maggie', price: 40, imageUrl: '/uploads/veggie_maggie.png' },
    { categoryId: catMaggie.id, name: 'Plain Cheese Maggie', price: 50, imageUrl: '/uploads/plain_cheese_maggie.png' },
    { categoryId: catMaggie.id, name: 'Veggie Cheese Maggie', price: 60, imageUrl: '/uploads/veggie_cheese_maggie.png' },
    { categoryId: catMaggie.id, name: 'Tandoori Maggie', price: 60, imageUrl: '/uploads/tandoori_maggie.png' },
    // Pizza
    { categoryId: catPizza.id, name: 'Sp. Cheese Bread Pizza', price: 99, imageUrl: '/uploads/sp_cheese_bread_pizza.png' },
    { categoryId: catPizza.id, name: 'Cheese Onion Capcicum', price: 99, imageUrl: '/uploads/cheese_onion_capcicum.png' },
    { categoryId: catPizza.id, name: 'Cheese Veg Paradise', price: 139, imageUrl: '/uploads/cheese_veg_paradise.png' },
    { categoryId: catPizza.id, name: 'Veggie Cheese Corn', price: 139, imageUrl: '/uploads/veggie_cheese_corn.png' },
    { categoryId: catPizza.id, name: 'Cheese Peppy Paneer', price: 149, imageUrl: '/uploads/cheese_peppy_paneer.png' },
    { categoryId: catPizza.id, name: 'Tandoori Paneer Pizza', price: 159, imageUrl: '/uploads/tandoori_paneer_pizza.png' },
    { categoryId: catPizza.id, name: 'Kadhai Paneer Pizza', price: 159, imageUrl: '/uploads/kadhai_paneer_pizza.png' },
    // Pasta
    { categoryId: catPasta.id, name: 'Veggie Paasta', price: 50, imageUrl: '/uploads/veggie_paasta.png' },
    { categoryId: catPasta.id, name: 'Red Sauce Paasta', price: 70, imageUrl: '/uploads/red_sauce_paasta.png' },
    { categoryId: catPasta.id, name: 'Cheesee Paasta', price: 80, imageUrl: '/uploads/cheesee_paasta.png' },
    // Fries
    { categoryId: catFries.id, name: 'Masla French Fries', price: 59, imageUrl: '/uploads/Masala_French_Fries.png' },
    { categoryId: catFries.id, name: 'Peri Peri French Fries', price: 69, imageUrl: '/uploads/peri_peri_french_fries.png' },
    { categoryId: catFries.id, name: 'Cheese French Fries', price: 79, imageUrl: '/uploads/cheese_french_fries.png' },
    // Combos
    { categoryId: catCombos.id, name: '1 Ch. Peppy Paneer Pizza + 1 Ch. Corn Sandwich + 2 Cold Coffe', price: 299, imageUrl: '/uploads/combo_peppy_paneer.png' },
    { categoryId: catCombos.id, name: '2 King Burger + 1 Ch. Fries + 2 Oreo Shake', price: 439, imageUrl: '/uploads/combo_king_burger.png' },
    { categoryId: catCombos.id, name: '1 Tandoori Pizza + 1 Veg Paradise Pizza + 2 Cold Coffe', price: 399, imageUrl: '/uploads/combo_tandoori_pizza.png' },
  ];

  const createdMenuItems = await Promise.all(menuData.map(item => 
    prisma.menuItem.create({
      data: {
        businessId: business.id,
        categoryId: item.categoryId,
        name: item.name,
        description: '100% Veg',
        price: item.price,
        imageUrl: item.imageUrl,
        isVeg: true,
        rating: 4.8,
      }
    })
  ));

  // Add-ons
  const maggieItems = createdMenuItems.filter(m => m.categoryId === catMaggie.id);
  for (const m of maggieItems) {
    await prisma.addOn.create({ data: { menuItemId: m.id, name: 'Double Masala', price: 5 } });
  }
  const pizzaItems = createdMenuItems.filter(m => m.categoryId === catPizza.id);
  for (const p of pizzaItems) {
    await prisma.addOn.create({ data: { menuItemId: p.id, name: 'Cheese Burst', price: 30 } });
  }

  // Get specific items for dummy orders
  // Welcome Coupon
  await prisma.coupon.create({
    data: { businessId: business.id, code: 'WELCOME20', discountType: 'percentage', value: 20, usageLimit: 100, expiresAt: new Date('2027-12-31') },
  });

  console.log('\n🎉 Clean Production Database Ready!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
