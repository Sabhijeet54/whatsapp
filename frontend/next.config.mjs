/** @type {import('next').NextConfig} */
const nextConfig = {
  // Reduce memory usage on low-RAM machines
  experimental: {
    workerThreads: false,
  },
};

export default nextConfig;
