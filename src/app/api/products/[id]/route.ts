import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sanitizePrice } from '@/lib/utils';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const product = await db.product.findUnique({
      where: { id },
      include: {
        shop: true,
        affiliateLinks: { take: 1 },
      },
    });

    if (!product) {
      return NextResponse.json({ error: 'Không tìm thấy sản phẩm' }, { status: 404 });
    }

    const cleanPrice = sanitizePrice(product.price);
    const cleanSalePrice = sanitizePrice(product.salePrice);

    return NextResponse.json({
      success: true,
      product: {
        ...product,
        price: cleanPrice,
        salePrice: cleanSalePrice,
        affiliateUrl: product.affiliateLinks[0]?.affiliateUrl || null,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Lỗi server' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();
    const { price, salePrice, commissionRate, name } = body;

    const dataToUpdate: any = {};

    if (price !== undefined) {
      dataToUpdate.price = sanitizePrice(Number(price));
    }
    if (salePrice !== undefined) {
      dataToUpdate.salePrice = sanitizePrice(Number(salePrice));
    }
    if (commissionRate !== undefined) {
      dataToUpdate.commissionRate = Number(commissionRate);
    }
    if (name !== undefined) {
      dataToUpdate.name = String(name).trim();
    }

    if (dataToUpdate.salePrice || dataToUpdate.commissionRate) {
      const existing = await db.product.findUnique({ where: { id } });
      if (existing) {
        const finalSale = dataToUpdate.salePrice ?? existing.salePrice;
        const finalComm = dataToUpdate.commissionRate ?? existing.commissionRate;
        dataToUpdate.estCommission = Math.round((finalSale * finalComm) / 100);
      }
    }

    const updatedProduct = await db.product.update({
      where: { id },
      data: dataToUpdate,
    });

    return NextResponse.json({
      success: true,
      product: updatedProduct,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Không thể cập nhật sản phẩm' }, { status: 500 });
  }
}
