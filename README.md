# yo-node-portal

**Portal for managing and hosting Node.js applications and scripts deployed via Docker.**

## Overview

yo-node-portal is a web-based management interface for deploying, monitoring, and configuring Node.js applications and scripts. It provides a unified dashboard to:

- 📦 **Discover applications** from `package.json` files
- 🚀 **Execute npm scripts** with one click
- 📊 **Monitor running processes** status
- 📝 **View real-time logs** with streaming
- ⚙️ **Edit configuration files** with JSON validation

## Features

- ✅ Tile-based dashboard
- ✅ Execute npm scripts from package.json
- ✅ Real-time log streaming
- ✅ JSON configuration editor
- ✅ Process health monitoring
- ✅ Docker-based isolation

## Documentation

See [specification.md](./specification.md) for detailed requirements and architecture.

## Getting Started

```bash
# Clone the repository
git clone https://github.com/yomiasistente/yo-node-portal.git
cd yo-node-portal

# Start with Docker
docker-compose up --build
```

## License

MIT
