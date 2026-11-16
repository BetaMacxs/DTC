import { DEFAULT_SETTINGS, parseSettings, type StoreSettings } from "@/lib/domain/settings";
import type { CatalogData } from "@/lib/domain/types";
import type { LocalData } from "@/server/backend/local/db";
import { demoCategories, demoCollections, demoProducts } from "./catalog";
import { DEMO_SETTINGS } from "./settings";

/**
 * The demo store, assembled. Used to fill a brand-new local store and by
 * "Load demo content" in the dashboard (on either backend). Every record is
 * flagged `isDemo`, so "Remove demo content" can take it all back out
 * without touching anything the owner created.
 */

export function demoCatalog(now = new Date()): CatalogData {
  return {
    categories: demoCategories(now),
    collections: demoCollections(now),
    products: demoProducts(now),
  };
}

export function demoSettings() {
  return parseSettings(DEMO_SETTINGS);
}

/**
 * Baseline settings for Detail Corner in production: ZAR currency, brand name,
 * and Crimson accent, with all contact, banking, VAT, and delivery fee fields
 * left unconfigured so no placeholder business details ever ship.
 */
export function detailCornerStarterSettings(): StoreSettings {
  return parseSettings({
    store: {
      name: "Detail Corner",
      tagline: "The Art of Perfection",
      description: "",
      logoUrl: "",
      language: "en",
      currency: "ZAR",
      siteUrl: "",
    },
    contact: {
      email: "",
      phone: "",
      whatsapp: "",
      address: "",
      hours: "",
    },
    checkout: {
      whatsapp: true,
      cashOnDelivery: false,
      bankTransfer: false,
      bankTransferInstructions: "",
      confirmationNote: "",
      vatEnabled: false,
      vatRate: 15,
      vatNumber: "",
    },
    theme: {
      accent: "#C41E3A",
      fontPairing: "signage",
      corners: "soft",
    },
    homepage: {
      announcement: { enabled: false, text: "", href: "" },
      hero: {
        enabled: true,
        eyebrow: "",
        heading: "Detail Corner",
        text: "",
        imageUrl: "",
        primaryLabel: "Shop now",
        primaryHref: "/shop",
        secondaryLabel: "",
        secondaryHref: "",
      },
      sections: DEFAULT_SETTINGS.homepage.sections,
    },
  });
}

const DEMO_GIFT_BANNER_IMAGE = "/demo/banners/gift-guide.jpg";
const DEMO_HERO_IMAGE = "/demo/hero/hero-1.jpg";
const DEMO_DESK_COLLECTION_ID = "de000000-0000-4000-8000-a00000000002";

/** Lists Halden demo settings fields still present in `settings`. */
export function detectDemoSettings(settings: StoreSettings): string[] {
  const sample = demoSettings();
  const hits: string[] = [];
  if (settings.store.name === sample.store.name || settings.store.description === sample.store.description) {
    hits.push("Store name/description (Halden)");
  }
  if (settings.contact.email === sample.contact.email) {
    hits.push("Demo contact email (hello@halden.example)");
  }
  if (settings.checkout.bankTransferInstructions === sample.checkout.bankTransferInstructions) {
    hits.push("Demo bank transfer instructions");
  }
  if (
    settings.homepage.hero.imageUrl === DEMO_HERO_IMAGE ||
    settings.homepage.hero.heading === sample.homepage.hero.heading ||
    settings.homepage.sections.some(
      (section) =>
        (section.type === "banner" && section.imageUrl === DEMO_GIFT_BANNER_IMAGE) ||
        (section.type === "products" && section.collectionId === DEMO_DESK_COLLECTION_ID),
    ) ||
    settings.homepage.announcement.text === sample.homepage.announcement.text
  ) {
    hits.push("Demo homepage hero, announcement, or banners");
  }
  if (
    settings.policies.about === sample.policies.about ||
    settings.policies.shipping === sample.policies.shipping ||
    settings.policies.returns === sample.policies.returns ||
    settings.policies.privacy === sample.policies.privacy
  ) {
    hits.push("Demo policy pages");
  }
  return hits;
}

/**
 * Resets only fields that still match the Halden demo template verbatim,
 * preserving every custom setting the store owner entered.
 */
export function stripDemoSettings(settings: StoreSettings): { settings: StoreSettings; cleanedFields: string[] } {
  const sample = demoSettings();
  const starter = detailCornerStarterSettings();
  const cleanedFields: string[] = [];
  const next: StoreSettings = structuredClone(settings);

  if (next.store.name === sample.store.name) {
    next.store.name = starter.store.name;
    cleanedFields.push("store.name");
  }
  if (next.store.tagline === sample.store.tagline) {
    next.store.tagline = starter.store.tagline;
    cleanedFields.push("store.tagline");
  }
  if (next.store.description === sample.store.description) {
    next.store.description = "";
    cleanedFields.push("store.description");
  }
  if (next.contact.email === sample.contact.email) {
    next.contact.email = "";
    cleanedFields.push("contact.email");
  }
  if (next.contact.hours === sample.contact.hours && next.store.name === starter.store.name) {
    next.contact.hours = "";
    cleanedFields.push("contact.hours");
  }
  if (next.checkout.bankTransferInstructions === sample.checkout.bankTransferInstructions) {
    next.checkout.bankTransferInstructions = "";
    next.checkout.bankTransfer = false;
    cleanedFields.push("checkout.bankTransferInstructions");
  }
  if (next.checkout.confirmationNote === sample.checkout.confirmationNote) {
    next.checkout.confirmationNote = "";
    cleanedFields.push("checkout.confirmationNote");
  }
  if (JSON.stringify(next.shipping) === JSON.stringify(sample.shipping)) {
    next.shipping = DEFAULT_SETTINGS.shipping;
    cleanedFields.push("shipping");
  }
  if (next.homepage.announcement.text === sample.homepage.announcement.text) {
    next.homepage.announcement = { enabled: false, text: "", href: "" };
    cleanedFields.push("homepage.announcement");
  }
  if (
    next.homepage.hero.imageUrl === DEMO_HERO_IMAGE ||
    next.homepage.hero.heading === sample.homepage.hero.heading
  ) {
    next.homepage.hero = {
      ...starter.homepage.hero,
      imageUrl: next.homepage.hero.imageUrl === DEMO_HERO_IMAGE ? "" : next.homepage.hero.imageUrl,
    };
    cleanedFields.push("homepage.hero");
  }
  const filteredSections = next.homepage.sections.filter((section) => {
    if (section.type === "banner" && section.imageUrl === DEMO_GIFT_BANNER_IMAGE) return false;
    if (section.type === "products" && section.collectionId === DEMO_DESK_COLLECTION_ID) return false;
    return true;
  });
  if (filteredSections.length !== next.homepage.sections.length) {
    next.homepage.sections = filteredSections.length > 0 ? filteredSections : DEFAULT_SETTINGS.homepage.sections;
    cleanedFields.push("homepage.sections");
  }
  for (const key of ["about", "shipping", "returns", "privacy"] as const) {
    if (next.policies[key] === sample.policies[key]) {
      next.policies[key] = "";
      cleanedFields.push(`policies.${key}`);
    }
  }

  return { settings: parseSettings(next), cleanedFields };
}

export function demoLocalData(): LocalData {
  return {
    version: 1,
    settings: demoSettings(),
    ...demoCatalog(),
    orders: [],
    nextOrderNumber: 1001,
    owner: null,
  };
}
