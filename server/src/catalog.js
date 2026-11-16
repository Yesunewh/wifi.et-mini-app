"use strict";
/**
 * Package catalogue. Prices and tiers come from the "Tier Detail" sheet of the
 * wifi.et financial model; validity periods (24 h / 7 d / 30 d) are assumptions
 * still to be confirmed. The server is the only source of prices: the app never
 * sends an amount, only a package id.
 */
const PACKAGES = [
  { id: "d500", group: "Daily", name: "Wi-Fi Daily 500MB", data: "500 MB", gb: 0.5, validity: "24 hours", validityHours: 24, price: 10 },
  { id: "d1", group: "Daily", name: "Wi-Fi Daily 1GB", data: "1 GB", gb: 1, validity: "24 hours", validityHours: 24, price: 15 },
  { id: "du", group: "Daily", name: "Wi-Fi Daily Unlimited", data: "Unlimited (5 GB fair use)", gb: 5, validity: "24 hours", validityHours: 24, price: 50 },
  { id: "w2", group: "Weekly", name: "Wi-Fi Weekly 2GB", data: "2 GB", gb: 2, validity: "7 days", validityHours: 168, price: 75 },
  { id: "w5", group: "Weekly", name: "Wi-Fi Weekly 5GB", data: "5 GB", gb: 5, validity: "7 days", validityHours: 168, price: 150 },
  { id: "wu", group: "Weekly", name: "Wi-Fi Weekly Unlimited", data: "Unlimited (20 GB fair use)", gb: 20, validity: "7 days", validityHours: 168, price: 300 },
  { id: "m10", group: "Monthly", name: "Wi-Fi Monthly 10GB", data: "10 GB", gb: 10, validity: "30 days", validityHours: 720, price: 400 },
  { id: "m20", group: "Monthly", name: "Wi-Fi Monthly 20GB", data: "20 GB", gb: 20, validity: "30 days", validityHours: 720, price: 700 },
  { id: "mu", group: "Monthly", name: "Wi-Fi Monthly Unlimited", data: "Unlimited (50 GB fair use)", gb: 50, validity: "30 days", validityHours: 720, price: 1200 },
];

/** Advertising formats and prices from the model's Assumptions sheet. */
const AD_FORMATS = [
  { id: "banner", icon: "banner", name: "Login-page banner", description: "Shown on the page people see when they connect", price: "ETB 175 / 1,000 views" },
  { id: "video", icon: "play", name: "Video ad", description: "Short video before free Wi-Fi access", price: "ETB 2.30 / view" },
  { id: "sms", icon: "sms", name: "Branded SMS", description: "Messages to users who opted in", price: "ETB 0.15 / SMS" },
  { id: "ssid", icon: "wifi", name: "Wi-Fi name branding", description: "Your brand in the network name at chosen hotspots", price: "Price on request" },
];

/** Sample hotspots for development. Replace with the real site list from the Wi-Fi platform. */
const SAMPLE_HOTSPOTS = [
  { id: "meskel", name: "Meskel Square", area: "Kirkos", lat: 9.0107, lng: 38.7612 },
  { id: "bole-medhanialem", name: "Bole Medhanialem", area: "Bole", lat: 8.9958, lng: 38.7869 },
  { id: "aau-6kilo", name: "Addis Ababa University, 6 Kilo", area: "Arada", lat: 9.0453, lng: 38.7614 },
  { id: "piassa", name: "Piassa", area: "Arada", lat: 9.0336, lng: 38.7505 },
  { id: "friendship-park", name: "Friendship Park", area: "Arada", lat: 9.0254, lng: 38.7633 },
];

const byId = (id) => PACKAGES.find((p) => p.id === id) || null;

module.exports = { PACKAGES, AD_FORMATS, SAMPLE_HOTSPOTS, packageById: byId };
