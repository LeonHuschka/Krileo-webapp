/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Ensure the invoice PDF fonts/logo are bundled into the serverless fn.
    outputFileTracingIncludes: {
      "/api/orders/[id]/invoice": [
        "./public/fonts/**",
        "./public/krileo-icon.png",
        "./public/duraska-logo.png",
      ],
    },
  },
};

export default nextConfig;
