import app from './app.js';
import { config } from './config/index.js';
import { prisma } from './prisma/client.js';

async function main() {
  try {
    // Test database connection
    console.log('Connecting to MongoDB...');
    await prisma.$connect();
    console.log('Connected to MongoDB');

    // Start server
    const server = app.listen(config.port, () => {
      console.log(`Server running on port ${config.port}`);
      console.log(`Health: http://localhost:${config.port}/health`);
      console.log(`API: http://localhost:${config.port}/api`);
    });

    // Graceful shutdown
    const shutdown = async () => {
      console.log('\nShutting down...');
      server.close(async () => {
        await prisma.$disconnect();
        console.log('Disconnected from MongoDB');
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error('Failed to start server:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
