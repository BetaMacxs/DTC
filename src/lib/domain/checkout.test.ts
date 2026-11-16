import { describe, expect, it } from "vitest";
import { product } from "./fixtures.test-utils";
import { checkoutErrors, checkoutSchema } from "./checkout";
import { quoteCart } from "./cart";
import { parseSettings } from "./settings";

describe("checkout configuration safeguards", () => {
  const settings = (instructions: string) =>
    parseSettings({
      checkout: { bankTransfer: true, bankTransferInstructions: instructions },
    });

  const inputFor = (store: ReturnType<typeof settings>) => {
    const item = product();
    const variant = item.variants[0];
    return {
      input: checkoutSchema.parse({
        method: "bank_transfer",
        shippingMethodId: store.shipping.methods[0].id,
        name: "Test Customer",
        phone: "+27123456789",
        email: "",
        line1: "1 Main Road",
        city: "Cape Town",
        region: "",
        postalCode: "",
        country: "South Africa",
        note: "",
        lines: [{ productId: item.id, variantId: variant.id, quantity: 1 }],
      }),
      quote: quoteCart(
        [{ productId: item.id, variantId: variant.id, quantity: 1 }],
        [item],
        store,
        store.shipping.methods[0].id,
      ),
    };
  };

  it("does not offer bank-transfer checkout without payment instructions", () => {
    const store = settings("");
    const { input, quote } = inputFor(store);
    expect(checkoutErrors(input, store, quote).method).toBe("method_disabled");
  });

  it("allows bank-transfer checkout when payment instructions are configured", () => {
    const store = settings("Bank: Example Bank\nAccount: 123456");
    const { input, quote } = inputFor(store);
    expect(checkoutErrors(input, store, quote).method).toBeUndefined();
  });
});
