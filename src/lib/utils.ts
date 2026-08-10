import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1) + 'M';
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1) + 'k';
  }
  return num.toString();
}

export interface CalculateScoreInput {
  sold: number;
  rating: number;
  price: number;
  salePrice: number;
  commissionRate: number;
  stock: number;
}

/**
 * Section 7 Requirement: "SẢN PHẨM ĐÁNG LÀM VIDEO" (Affiliate Score 0-100)
 * Evaluates product potential based on sales momentum, commission rate, discount depth, rating, and stock availability.
 */
export function calculateAffiliateScore(p: CalculateScoreInput): number {
  let score = 50; // base

  // 1. Sales volume weight (max +25 points)
  if (p.sold > 10000) score += 25;
  else if (p.sold > 5000) score += 20;
  else if (p.sold > 1000) score += 15;
  else if (p.sold > 200) score += 10;
  else if (p.sold > 50) score += 5;

  // 2. Commission Rate weight (max +25 points)
  if (p.commissionRate >= 15) score += 25;
  else if (p.commissionRate >= 10) score += 20;
  else if (p.commissionRate >= 7) score += 15;
  else if (p.commissionRate >= 4) score += 10;
  else if (p.commissionRate >= 2) score += 5;

  // 3. Discount weight (max +15 points)
  const discountPercent = p.price > 0 ? ((p.price - p.salePrice) / p.price) * 100 : 0;
  if (discountPercent >= 50) score += 15;
  else if (discountPercent >= 30) score += 10;
  else if (discountPercent >= 15) score += 5;

  // 4. Customer Rating weight (max +15 points)
  if (p.rating >= 4.8) score += 15;
  else if (p.rating >= 4.5) score += 10;
  else if (p.rating >= 4.0) score += 5;
  else if (p.rating < 3.5) score -= 15;

  // 5. Stock stability penalty
  if (p.stock <= 0) score -= 40;
  else if (p.stock < 10) score -= 15;

  // Clamp between 0 and 100
  return Math.min(100, Math.max(0, Math.round(score)));
}
