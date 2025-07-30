# Contributing to Cloudflare Tunnel Vite Plugin

Thank you for your interest in contributing! This guide will help you get started.

## Development Setup

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/eastlondoner/vite-plugin-cloudflare-tunnel.git
   cd vite-plugin-cloudflare-tunnel
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up your environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your Cloudflare API token
   ```

## Development Workflow

### Building the Plugin

```bash
# Build the plugin
npm run build

# Build in watch mode during development
npm run dev
```

### Type Checking

```bash
# Run TypeScript type checking
npm run typecheck
```

### Code Quality

```bash
# Lint the code
npm run lint

# Fix linting issues automatically
npm run lint:fix
```

### Testing

```bash
# Test the plugin with the example app
cd examples/basic-vite-app
npm install
npm run dev
```

## Code Style

- Use TypeScript for all code
- Follow the existing code patterns and conventions
- Add JSDoc comments for public APIs
- Keep functions focused and well-named
- Use meaningful variable names

## Commit Guidelines

- Use clear, descriptive commit messages
- Follow conventional commit format when possible:
  - `feat:` for new features
  - `fix:` for bug fixes
  - `docs:` for documentation changes
  - `refactor:` for code refactoring
  - `test:` for test changes

## Pull Request Process

1. **Create a feature branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes:**
   - Write clear, maintainable code
   - Add tests if applicable
   - Update documentation as needed

3. **Test your changes:**
   ```bash
   npm run build
   npm run typecheck
   npm run lint
   ```

4. **Test with the example app:**
   ```bash
   cd examples/basic-vite-app
   npm run dev
   ```

5. **Submit your pull request:**
   - Provide a clear description of the changes
   - Link to any related issues
   - Include screenshots if applicable

## Reporting Issues

When reporting issues, please include:

- Plugin version
- Node.js version
- Vite version
- Operating system
- Clear steps to reproduce
- Expected vs actual behavior
- Relevant logs or error messages

## Feature Requests

For feature requests:

1. Check existing issues to avoid duplicates
2. Clearly describe the proposed feature
3. Explain the use case and benefits
4. Consider providing a proof of concept

## Security Issues

For security vulnerabilities, please:

- **Do not** create public GitHub issues
- Email security concerns privately
- Provide detailed information about the vulnerability
- Allow time for the issue to be addressed before disclosure

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help maintain a welcoming environment for all contributors

## Questions?

- Check the [README](README.md) for basic usage
- Look through existing [issues](https://github.com/eastlondoner/vite-plugin-cloudflare-tunnel/issues)
- Create a new issue for questions not covered elsewhere

Thank you for contributing! 🎉