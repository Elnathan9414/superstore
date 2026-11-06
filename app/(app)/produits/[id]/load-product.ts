import "server-only";
import { notFound } from "next/navigation";
import { getProduct } from "@/lib/data/catalog";
import { idSchema } from "@/lib/validation/products";

/** Loads the product from the [id] route param, or renders the 404 page. */
export async function loadProduct(params: Promise<{ id: string }>) {
  const { id } = await params;
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) notFound();
  const product = await getProduct(parsed.data);
  if (!product) notFound();
  return product;
}
