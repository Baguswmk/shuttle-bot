import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3012/api';
    let destination = 'http://localhost:3012/uploads/:path*';
    
    if (apiUrl.includes('localhost') || apiUrl.includes('127.0.0.1')) {
      const backendUrl = apiUrl.replace(/\/api$/, '');
      destination = `${backendUrl}/uploads/:path*`;
    } else {
      destination = 'http://localhost:3012/uploads/:path*';
    }
    
    return [
      {
        source: '/uploads/:path*',
        destination: destination,
      },
    ];
  },
};

export default nextConfig;
