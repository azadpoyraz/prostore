"use server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { auth } from "@/auth";
import { formatError } from "../utils";
import { cartItemSchema, insertCartSchema } from "../validator";
import { prisma } from "@/db/prisma";
import { CartItem } from "@/types";
import { Prisma } from "@prisma/client";
import { convertToPlainObject, round2 } from "../utils";

// Calculate cart price based on items
const calcPrice = (items: z.infer<typeof cartItemSchema>[]) => {
  const itemsPrice = round2(
      items.reduce((acc, item) => acc + Number(item.price) * item.qty, 0),
    ),
    shippingPrice = round2(itemsPrice > 100 ? 0 : 10),
    taxPrice = round2(0.15 * itemsPrice),
    totalPrice = round2(itemsPrice + shippingPrice + taxPrice);
  return {
    itemsPrice: itemsPrice.toFixed(2),
    shippingPrice: shippingPrice.toFixed(2),
    taxPrice: taxPrice.toFixed(2),
    totalPrice: totalPrice.toFixed(2),
  };
};

// Veritabanında sepete öğe ekleme işlemi
export const addItemToCart = async (data: z.infer<typeof cartItemSchema>) => {
  try {
    // Session sepet çerezini kontrol et
    const sessionCartId = (await cookies()).get("sessionCartId")?.value;
    if (!sessionCartId) throw new Error("Cart Session not found");

    // Oturum ve kullanıcı ID'sini al
    const session = await auth();
    const userId = session?.user?.id as string | undefined;

    // Veritabanından mevcut sepeti getir
    const cart = await getMyCart();

    // Gönderilen öğe verisini doğrula
    const item = cartItemSchema.parse(data);

    // Ürünü veritabanında bul
    const product = await prisma.product.findFirst({
      where: { id: item.productId },
    });
    if (!product) throw new Error("Product not found");

    if (!cart) {
      // Create new cart object
      const newCart = insertCartSchema.parse({
        userId: userId,
        items: [item],
        sessionCartId: sessionCartId,
        ...calcPrice([item]),
      });
      // Add to database
      await prisma.cart.create({
        data: newCart,
      });

      // Revalidate product page
      revalidatePath(`/product/${product.slug}`);

      return {
        success: true,
        message: `${product.name} added to cart successfully`,
      };
    } else {
      // 1. Sepette bu ürün zaten var mı kontrol et
      const existItem = (cart.items as CartItem[]).find(
        (x) => x.productId === item.productId,
      );

      if (existItem) {
        // 2. Stok kontrolü: Mevcut adet + 1 stoktan fazlaysa hata ver
        if (product.stock < existItem.qty + 1) {
          throw new Error("Not enough stock");
        }

        // 3. Varsa miktarını (qty) artır
        (cart.items as CartItem[]).find(
          (x) => x.productId === item.productId,
        )!.qty = existItem.qty + 1;
      } else {
        // 4. Ürün sepette yoksa ve stok varsa yeni olarak ekle
        if (product.stock < 1) throw new Error("Not enough stock");
        cart.items.push(item);
      }

      // 5. Veritabanını güncelle
      await prisma.cart.update({
        where: { id: cart.id },
        data: {
          //items: cart.items as Prisma.JsonValue[], // Tip hatası alırsan JsonValue kullanabilirsin
          items: cart.items as Prisma.InputJsonValue[],
          ...calcPrice(cart.items as CartItem[]),
        },
      });

      revalidatePath(`/product/${product.slug}`);

      return {
        success: true,
        message: `${product.name} ${
          existItem ? "updated in" : "added to"
        } cart successfully`,
      };
    }

    // Test logları
    console.log({
      "Session Cart ID": sessionCartId,
      "User ID": userId,
      "Item Requested": item,
      "Product Found": product,
      cart: cart,
    });

    return {
      success: true,
      message: "Testing Cart",
    };
  } catch (error) {
    return { success: false, message: formatError(error) };
  }
};

// Kullanıcı sepetini veritabanından getirme işlemi
export async function getMyCart() {
  // Session sepet çerezini kontrol et
  const sessionCartId = (await cookies()).get("sessionCartId")?.value;
  if (!sessionCartId) return undefined;

  // Oturum ve kullanıcı ID'sini al
  const session = await auth();
  const userId = session?.user?.id;

  // Kullanıcı ID varsa ona göre, yoksa sepet ID'ye göre ara
  const cart = await prisma.cart.findFirst({
    where: userId ? { userId: userId } : { sessionCartId: sessionCartId },
  });

  if (!cart) return undefined;

  // Decimal değerleri string'e çevirerek döndür
  return convertToPlainObject({
    ...cart,
    items: cart.items as CartItem[],
    itemsPrice: cart.itemsPrice.toString(),
    totalPrice: cart.totalPrice.toString(),
    shippingPrice: cart.shippingPrice.toString(),
    taxPrice: cart.taxPrice.toString(),
  });
}

// Veritabanından sepet öğesini silme veya azaltma
export async function removeItemFromCart(productId: string) {
  try {
    // Oturum sepet kimliğini (sessionCartId) al
    const sessionCartId = (await cookies()).get("sessionCartId")?.value;
    if (!sessionCartId) throw new Error("Cart Session not found");

    // Ürünü veritabanından getir
    const product = await prisma.product.findFirst({
      where: { id: productId },
    });
    if (!product) throw new Error("Product not found");

    // Kullanıcının sepetini getir
    const cart = await getMyCart();
    if (!cart) throw new Error("Cart not found");

    // Ürünün sepette olup olmadığını kontrol et
    const exist = (cart.items as CartItem[]).find(
      (x) => x.productId === productId,
    );
    if (!exist) throw new Error("Item not found");

    // Sepette üründen sadece bir tane mi var kontrol et
    if (exist.qty === 1) {
      // Ürünü sepetten tamamen kaldır
      cart.items = (cart.items as CartItem[]).filter(
        (x) => x.productId !== exist.productId,
      );
    } else {
      // Mevcut ürünün miktarını bir azalt
      (cart.items as CartItem[]).find((x) => x.productId === productId)!.qty =
        exist.qty - 1;
    }

    // Veritabanındaki sepeti güncelle
    await prisma.cart.update({
      where: { id: cart.id },
      data: {
        items: cart.items as Prisma.CartUpdateitemsInput[],
        ...calcPrice(cart.items as CartItem[]),
      },
    });

    // Ürün sayfasını yeniden doğrula (önbelleği temizle)
    revalidatePath(`/product/${product.slug}`);

    return {
      success: true,
      message: `${product.name} ${
        (cart.items as CartItem[]).find((x) => x.productId === productId)
          ? "updated in"
          : "removed from"
      } cart successfully`,
    };
  } catch (error) {
    return { success: false, message: formatError(error) };
  }
}
