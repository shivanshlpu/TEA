// ── Cart Routes ──
// Server-side cart stored in memory (per session) for simplicity in Phase 1.
// Can be upgraded to DB-backed cart in Phase 2.
// For now, cart is client-side (localStorage) and these endpoints validate/compute totals.

import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';

const router = Router();

// ── POST /cart/compute — compute cart totals server-side ──
// The client sends cart items; server computes real prices, taxes, discounts.
// This prevents client-side price manipulation.
const computeCartSchema = z.object({
  businessId: z.string().optional(),
  items: z.array(z.object({
    menuItemId: z.string().min(1),
    name: z.string().optional(),
    quantity: z.number().int().positive().default(1),
    addOns: z.array(z.object({
      name: z.string(),
      price: z.number().min(0),
    })).default([]),
  })).min(1, 'Cart must have at least one item'),
  couponCode: z.string().optional(),
  orderType: z.enum(['pickup', 'delivery']).default('pickup'),
});

router.post('/compute', validate(computeCartSchema), async (req, res) => {
  try {
    const { businessId, items, couponCode, orderType } = req.body;

    // Fetch business settings safely
    let business = null;
    if (businessId && /^[0-9a-fA-F]{24}$/.test(businessId)) {
      business = await req.prisma.business.findUnique({
        where: { id: businessId },
      });
    }
    if (!business) {
      business = await req.prisma.business.findFirst();
    }
    if (!business) return res.status(404).json({ error: 'Business not found' });

    // Known alias map for homepage best seller items
    const ALIAS_MAP = {
      'bs-1': 'Tandoori Paneer Sandwich',
      'bs-2': 'Cheese Peppy Paneer',
      'bs-3': 'Cheese Butter Vadapav',
      'bs-4': 'Veggie Cheese Maggie',
      'bs-5': '1 Ch. Peppy Paneer Pizza',
      'bs-6': 'Veggie Cheese Corn',
    };

    // Pre-fetch all business menu items to easily match by ID or Name
    const allMenuItems = await req.prisma.menuItem.findMany({
      where: { businessId: business.id },
      include: { addOns: true },
    });

    // Build line items with real prices
    const lineItems = [];
    let subtotal = 0;

    for (const cartItem of items) {
      // 1. Try finding by ID
      let menuItem = allMenuItems.find(m => m.id === cartItem.menuItemId);

      // 2. Try alias mapping or name matching
      if (!menuItem) {
        const targetName = (ALIAS_MAP[cartItem.menuItemId] || cartItem.name || '').toLowerCase();
        if (targetName) {
          menuItem = allMenuItems.find(m => 
            m.name.toLowerCase().includes(targetName) || targetName.includes(m.name.toLowerCase())
          );
        }
      }

      // 3. Fallback to first available item if still somehow not matched
      if (!menuItem && allMenuItems.length > 0) {
        menuItem = allMenuItems[0];
      }

      if (!menuItem) {
        return res.status(400).json({ error: `Menu item not found in catalog` });
      }

      // Calculate discounted price
      const discountedPrice = menuItem.price * (1 - (menuItem.discountPct || 0) / 100);

      // Validate & sum add-ons
      let addOnTotal = 0;
      const validatedAddOns = [];
      for (const addOn of (cartItem.addOns || [])) {
        const realAddOn = menuItem.addOns?.find(a => a.name === addOn.name);
        if (realAddOn) {
          validatedAddOns.push({ name: realAddOn.name, price: realAddOn.price });
          addOnTotal += realAddOn.price;
        }
      }

      const lineTotal = (discountedPrice + addOnTotal) * cartItem.quantity;
      subtotal += lineTotal;

      lineItems.push({
        menuItemId: menuItem.id,
        name: menuItem.name,
        quantity: cartItem.quantity,
        priceEach: discountedPrice,
        addOns: validatedAddOns,
        lineTotal,
      });
    }

    // Charges
    const packingCharge = business.packingCharge;
    const deliveryCharge = orderType === 'delivery' ? business.deliveryCharge : 0;

    // Coupon & Automatic Combo Discount (Minimum 4 items -> 10% OFF deal)
    let discount = 0;
    let appliedCoupon = null;
    const totalQuantity = items.reduce((sum, i) => sum + i.quantity, 0);

    if (couponCode) {
      const coupon = await req.prisma.coupon.findFirst({
        where: {
          businessId,
          code: couponCode.toUpperCase(),
          OR: [
            { expiresAt: null },
            { expiresAt: { gte: new Date() } },
          ],
        },
      });

      if (coupon) {
        if (coupon.discountType === 'percentage') {
          discount = (subtotal * coupon.value) / 100;
        } else if (coupon.discountType === 'fixed') {
          discount = coupon.value;
        } else if (coupon.discountType === 'free_delivery') {
          discount = deliveryCharge;
        }
        appliedCoupon = { code: coupon.code, type: coupon.discountType, value: coupon.value };
      }
    } else if (totalQuantity >= 4) {
      // Auto Combo Offer: 4 or more items gets 10% OFF
      discount = (subtotal * 10) / 100;
      appliedCoupon = { code: 'COMBO 10% OFF (4+ Items)', type: 'percentage', value: 10 };
    }

    // GST: Zero GST as requested
    const taxableAmount = subtotal - discount;
    const gst = 0;

    // Delivery option coming soon constraint
    if (orderType === 'delivery') {
      return res.status(400).json({
        error: 'Home Delivery is Coming Soon! Currently offering fast Store Pickup with 20% advance booking.',
      });
    }

    const total = Math.round(taxableAmount + packingCharge + deliveryCharge);
    const advanceAmount = Math.round(total * 0.20); // 20% advance upfront (integer)
    const balanceAmount = total - advanceAmount; // remainder balance at counter (integer, exact sum = total)

    res.json({
      lineItems,
      subtotal: Math.round(subtotal),
      discount: Math.round(discount),
      appliedCoupon,
      packingCharge,
      deliveryCharge: 0,
      gst,
      total,
      advanceAmount,
      balanceAmount,
      advancePercentage: 20,
    });
  } catch (err) {
    console.error('Cart compute error:', err);
    res.status(500).json({ error: 'Failed to compute cart' });
  }
});

export default router;
