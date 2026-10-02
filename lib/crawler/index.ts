import { crawlGeneric } from "./generic";
import { crawlShopee } from "./shopee";
import { validatePublicUrl } from "@/lib/validation/url";

export async function crawlProduct(input: string) {
  const url = await validatePublicUrl(input);
  const shopee =
    url.hostname === "shopee.vn" || url.hostname.endsWith(".shopee.vn");
  return shopee ? crawlShopee(url.href) : crawlGeneric(url.href);
}
