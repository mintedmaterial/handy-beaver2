/**
 * Site Configuration - Template Variables
 * 
 * All business-specific values are defined here.
 * Change these to rebrand the entire app.
 */

export const siteConfig = {
  // Business Identity
  business: {
    name: "The Handy Beaver",
    tagline: "Your Traveling Craftsman & Maintenance Service",
    description: "Professional carpentry, flooring, deck repair, and residential maintenance for Southeast Oklahoma",
    mascot: "🦫",
    email: "contact@thehandybeaver.com",
    phone: "", // TBD
    serviceArea: "Southeast Oklahoma",
  },

  // URLs (Workers dev links, custom domain later)
  urls: {
    site: "https://handy-beaver.srvcflo.workers.dev", // Workers dev URL
    api: "https://handy-beaver.srvcflo.workers.dev/api", // Same worker, /api routes
  },

  // Social Media (to be configured)
  social: {
    facebook: {
      pageId: "", // TBD - Minte will set up
      appId: "", // TBD
    },
    instagram: "",
  },

  // Payment Integration
  payments: {
    square: {
      applicationId: "", // TBD - Minte will set up
      locationId: "", // TBD
      environment: "sandbox" as "sandbox" | "production",
    },
  },

  // Pricing Structure
  pricing: {
    labor: {
      underSixHours: 175.00,
      overSixHours: 300.00, // per day
    },
    helper: {
      underSixHours: 100.00,
      overSixHours: 225.00, // per day
    },
    notes: "Customer pays all materials, consumables, and equipment rental",
  },

  // Google/Email Integration
  integrations: {
    googleCalendar: {
      email: "serviceflowagi@gmail.com",
    },
    email: {
      from: "noreply@thehandybeaver.com",
      support: "support@thehandybeaver.com",
    },
  },

  // Discord Notifications
  discord: {
    webhookUrl: "", // TBD - for scheduling notifications
    channelId: "1479281060222337034", // This thread
  },

  // AI Image Generation (Gemini Pro)
  imageGeneration: {
    provider: "google",
    model: "gemini-pro", // For visualizing project outcomes
    useCase: "Upload photo → AI shows finished project (siding, paint, repairs)",
  },

  // Design Theme
  theme: {
    style: "barnwood",
    cardEffect: "white-glow",
    colors: {
      primary: "#8B4513", // Saddle brown (wood)
      secondary: "#D2691E", // Chocolate
      accent: "#F5DEB3", // Wheat
      background: "#2C1810", // Dark wood
      card: "#FFFFFF",
      cardGlow: "rgba(255, 255, 255, 0.3)",
    },
  },
} as const;

export type SiteConfig = typeof siteConfig;
