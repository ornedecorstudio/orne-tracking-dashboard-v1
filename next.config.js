/** @type {import('next').NextConfig} */
const nextConfig = {
  // Variáveis de ambiente que serão usadas no código
  env: {
    SHOPIFY_STORE_DOMAIN: process.env.SHOPIFY_STORE_DOMAIN,
    SHOPIFY_ACCESS_TOKEN: process.env.SHOPIFY_ACCESS_TOKEN,
    TRACKING_API_KEY: process.env.TRACKING_API_KEY,
  },
}

module.exports = nextConfig
