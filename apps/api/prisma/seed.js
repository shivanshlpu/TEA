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
      phoneNumber: '+917000748920',
      whatsappNumber: '+917000748920',
    },
  });
  console.log(`✅ Business: ${business.name} (${business.id})`);

  const ownerHash = await bcrypt.hash(process.env.SEED_OWNER_PASSWORD || 'ChangeMeOnFirstLogin!#123', 10);
  const ownerUser = await prisma.user.create({
    data: {
      businessId: business.id, role: 'owner', name: 'Store Owner',
      phone: process.env.SEED_OWNER_PHONE || '+917000748920', email: 'owner@cafedream.in', passwordHash: ownerHash,
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

  // ── Categories (Exact Reference Menu Order) ──
  const catChai = await prisma.category.create({ data: { businessId: business.id, name: 'CHAI & MORE', sortOrder: 1 } });
  const catBurger = await prisma.category.create({ data: { businessId: business.id, name: 'BURGERRR', sortOrder: 2 } });
  const catMaggie = await prisma.category.create({ data: { businessId: business.id, name: 'MAGGIE', sortOrder: 3 } });
  const catPizza = await prisma.category.create({ data: { businessId: business.id, name: 'PIZZAAAH', sortOrder: 4 } });
  const catSandwich = await prisma.category.create({ data: { businessId: business.id, name: 'SANDWICH', sortOrder: 5 } });
  const catFries = await prisma.category.create({ data: { businessId: business.id, name: 'FRENCH FRIES', sortOrder: 6 } });
  const catVadaPav = await prisma.category.create({ data: { businessId: business.id, name: 'VADA PAV', sortOrder: 7 } });
  const catPasta = await prisma.category.create({ data: { businessId: business.id, name: 'PAAAASTA', sortOrder: 8 } });

  // ── Menu Items (Exact 38 Reference Menu Items & Pricing) ──
  const menuData = [
    // Chai & More
    { categoryId: catChai.id, name: 'Chai', price: 10, imageUrl: '/uploads/chai.png', description: 'Classic authentic Indian milk chai brewed with aromatic herbs and spices' },
    { categoryId: catChai.id, name: 'Chai (Big Cup)', price: 20, imageUrl: '/uploads/chai_big_cup.png', description: 'Generous large cup of our aromatic signature masala chai' },
    { categoryId: catChai.id, name: 'Coffee', price: 25, imageUrl: '/uploads/coffee.png', description: 'Hot brewed rich aromatic coffee with velvety froth' },
    { categoryId: catChai.id, name: 'Black Coffee', price: 20, imageUrl: '/uploads/black_coffee.png', description: 'Bold and invigorating pure black coffee brewed to perfection' },
    { categoryId: catChai.id, name: 'Cold Coffee', price: 69, imageUrl: '/uploads/cold_coffee.png', description: 'Chilled creamy blended coffee topped with chocolate drizzle' },

    // Burgers
    { categoryId: catBurger.id, name: 'Aloo Tikki', price: 49, imageUrl: '/uploads/veggie_aloo_patty.png', description: 'Crispy golden spiced aloo tikki patty in a soft toasted bun' },
    { categoryId: catBurger.id, name: 'Veggie Aloo Tikki', price: 59, imageUrl: '/uploads/veggie_aloo_tikki.png', description: 'Crisp aloo tikki loaded with fresh garden vegetables and creamy mayo' },
    { categoryId: catBurger.id, name: 'Veggie Cheese Burger', price: 89, imageUrl: '/uploads/veggie_cheese_burger.png', description: 'Crispy vegetable patty layered with melted cheese slice and house sauce' },
    { categoryId: catBurger.id, name: 'Veggie Paneer Cheese', price: 99, imageUrl: '/uploads/veggie_paneer_cheese.png', description: 'Succulent paneer slab and veg patty with melted cheese and fresh greens' },
    { categoryId: catBurger.id, name: 'Tandoori Panner Burger', price: 99, imageUrl: '/uploads/veggie_paneer_cheese.png', description: 'Smoky marinated tandoori paneer patty with spicy tandoori mayo' },
    { categoryId: catBurger.id, name: 'Veg. 2X Patty & Cheese', price: 119, imageUrl: '/uploads/veg_double_patty_cheese.png', description: 'Double crispy patty stacked with double cheese and signature sauce' },

    // Maggie
    { categoryId: catMaggie.id, name: 'Plain Maggie', price: 49, imageUrl: '/uploads/plain_maggie.png', description: 'Classic comforting hot masala noodles' },
    { categoryId: catMaggie.id, name: 'Veggie Maggie', price: 59, imageUrl: '/uploads/veggie_maggie.png', description: 'Masala noodles tossed with crunchy onions, peas, and carrots' },
    { categoryId: catMaggie.id, name: 'Plain Cheese Maggie', price: 59, imageUrl: '/uploads/plain_cheese_maggie.png', description: 'Hot classic Maggie loaded with melted mozzarella & cheddar' },
    { categoryId: catMaggie.id, name: 'Veggie Cheese Maggie', price: 69, imageUrl: '/uploads/veggie_cheese_maggie.png', description: 'The all-time favourite noodles loaded with veggies and melted cheese' },
    { categoryId: catMaggie.id, name: 'Tandoori Maggie', price: 69, imageUrl: '/uploads/tandoori_maggie.png', description: 'Spicy noodles infused with smoky tandoori flavors and spices' },
    { categoryId: catMaggie.id, name: 'Chilli Garlic Maggie', price: 69, imageUrl: '/uploads/chilli_garlic_maggie.png', description: 'Zesty noodles tossed with hot roasted garlic and red chilli sauce' },

    // Pizza
    { categoryId: catPizza.id, name: 'Cheese Onion Capcicum', price: 89, imageUrl: '/uploads/cheese_onion_capcicum.png', description: 'Crisp hand-tossed base with crunchy onions, green capsicum & gooey mozzarella' },
    { categoryId: catPizza.id, name: 'Cheese Veg Paradise', price: 99, imageUrl: '/uploads/cheese_veg_paradise.png', description: 'Loaded with golden corn, black olives, crisp bell peppers, and melted cheese' },
    { categoryId: catPizza.id, name: 'Veggie Cheese Corn', price: 129, imageUrl: '/uploads/veggie_cheese_corn.png', description: 'Generous helping of sweet American corn with double cheese on crisp crust' },
    { categoryId: catPizza.id, name: 'Cheese Peppy Paneer', price: 139, imageUrl: '/uploads/cheese_peppy_paneer.png', description: 'Spiced peppy paneer chunks paired with crisp red and green capsicum' },
    { categoryId: catPizza.id, name: 'Tandoori Paneer Pizza', price: 149, imageUrl: '/uploads/tandoori_paneer_pizza.png', description: 'Tandoori-marinated cottage cheese cubes on spicy makhani sauce base' },

    // Sandwich
    { categoryId: catSandwich.id, name: 'Veggie Sandwich', price: 59, imageUrl: '/uploads/veggie_sandwich.png', description: 'Fresh cucumber, tomato, onion and mint chutney in grilled bread' },
    { categoryId: catSandwich.id, name: 'Only Ch. Corn Sandwich', price: 69, imageUrl: '/uploads/cheese_corn_sandwich.png', description: 'Grilled golden sandwich stuffed with sweet corn and melted cheese' },
    { categoryId: catSandwich.id, name: 'Veggie Ch. Corn Sandwich', price: 89, imageUrl: '/uploads/veggie_ch_corn_sandwich.png', description: 'Crunchy vegetables, juicy sweet corn, and rich melted cheese grilled crisp' },
    { categoryId: catSandwich.id, name: 'Tandoori Paneer Sandwich', price: 89, imageUrl: '/uploads/tandoori_paneer_sandwich.jpg', description: 'Smoky grilled paneer slices with tandoori spices and cheese' },
    { categoryId: catSandwich.id, name: 'Tandoori Paneer 2X Layer', price: 119, imageUrl: '/uploads/tandoori_paneer_2x_layer.jpg', description: 'Double-decker grilled sandwich stacked with two layers of tandoori paneer' },
    { categoryId: catSandwich.id, name: 'Cheese Brust Sandwich', price: 129, imageUrl: '/uploads/tea_bhatti_special.png', description: 'Overflowing cheese explosion inside golden grilled sandwich bread' },

    // French Fries
    { categoryId: catFries.id, name: 'Masla French Fries', price: 69, imageUrl: '/uploads/Masala_French_Fries.png', description: 'Crispy golden potato fries dusted with authentic chaat & peri masala' },
    { categoryId: catFries.id, name: 'Peri Peri French Fries', price: 79, imageUrl: '/uploads/peri_peri_french_fries.png', description: 'Fiery and tangy peri-peri seasoning over hot crispy potato fries' },
    { categoryId: catFries.id, name: 'Cheese French Fries', price: 89, imageUrl: '/uploads/cheese_french_fries.png', description: 'Golden fries generously smothered in warm melted cheddar cheese sauce' },

    // Vada Pav
    { categoryId: catVadaPav.id, name: 'Butter Vadapav', price: 29, imageUrl: '/uploads/butter_vadapav.png', description: 'Authentic spiced potato batata vada inside butter-toasted pav with garlic chutney' },
    { categoryId: catVadaPav.id, name: 'Cheese Butter Vadapav', price: 39, imageUrl: '/uploads/cheese_butter_vadapav.png', description: 'Hot buttery vadapav layered with rich melted cheese and fried green chilli' },
    { categoryId: catVadaPav.id, name: 'Tandoori Vadapav', price: 39, imageUrl: '/uploads/tandoori_vadapav.png', description: 'Crispy vadapav slathered with smoky tandoori sauce and spicy chutney' },

    // Pasta
    { categoryId: catPasta.id, name: 'Veggie Paasta', price: 59, imageUrl: '/uploads/veggie_paasta.png', description: 'Tender penne pasta tossed with fresh vegetables in seasoned herb olive sauce' },
    { categoryId: catPasta.id, name: 'Red Sauce Paasta', price: 79, imageUrl: '/uploads/red_sauce_paasta.png', description: 'Tangy and spicy Italian arrabbiata tomato sauce with garden vegetables' },
    { categoryId: catPasta.id, name: 'Cheesee Paasta', price: 99, imageUrl: '/uploads/cheesee_paasta.png', description: 'Creamy macaroni & cheese pasta loaded with melted cheese and herbs' },
    { categoryId: catPasta.id, name: 'White Sauce Paasta', price: 129, imageUrl: '/uploads/white_sauce_paasta.png', description: 'Rich, velvety Alfredo white sauce pasta with capsicum, sweet corn, and oregano' },
  ];

  const createdMenuItems = await Promise.all(menuData.map(item => 
    prisma.menuItem.create({
      data: {
        businessId: business.id,
        categoryId: item.categoryId,
        name: item.name,
        description: item.description || '100% Veg',
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
  const friesItems = createdMenuItems.filter(m => m.categoryId === catFries.id);
  for (const f of friesItems) {
    await prisma.addOn.create({ data: { menuItemId: f.id, name: 'Cheese Dip', price: 30 } });
  }

  // Get specific items for dummy orders
  // Welcome Coupon
  await prisma.coupon.create({
    data: { businessId: business.id, code: 'WELCOME20', discountType: 'percentage', value: 20, usageLimit: 100, expiresAt: new Date('2027-12-31') },
  });

  console.log('\n🎉 Clean Production Database Ready!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
