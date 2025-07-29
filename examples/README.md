# Examples

This directory contains example projects demonstrating how to use the `cloudflare-tunnel-vite-plugin`.

## Available Examples

### [basic-vite-app](./basic-vite-app)
A minimal Vite application showcasing the core functionality of the plugin:
- Automatic tunnel creation
- DNS management
- Environment variable configuration
- Basic tunnel status detection

## Running Examples

1. **Build the plugin first:**
   ```bash
   cd ..
   npm run build
   ```

2. **Navigate to an example:**
   ```bash
   cd examples/basic-vite-app
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Configure your environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your Cloudflare API token
   ```

5. **Update the hostname in `vite.config.ts`** to match a domain in your Cloudflare account

6. **Start development:**
   ```bash
   npm run dev
   ```

## Prerequisites

- A Cloudflare account with a domain added
- A Cloudflare API token with appropriate permissions:
  - `Zone:Zone:Read`
  - `Zone:DNS:Edit` 
  - `Account:Cloudflare Tunnel:Edit`

## Contributing

Feel free to contribute additional examples that demonstrate specific use cases or integrations!