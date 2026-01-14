# Contributing to OdinPool

Thank you for your interest in contributing to OdinPool! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Code Style Guidelines](#code-style-guidelines)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/OdinPool.git`
3. Add upstream remote: `git remote add upstream https://github.com/Qvantitative/OdinPool.git`
4. Create a new branch: `git checkout -b feature/your-feature-name`

## Development Setup

### Prerequisites

- Node.js 18 or higher
- PostgreSQL 12 or higher
- Bitcoin Core node with RPC access (for blockchain features)
- Git

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

## Code Style Guidelines

### JavaScript/React

- Use ES6+ features (async/await, destructuring, arrow functions)
- Use functional components with hooks for React
- Follow the existing code style in the project
- Use meaningful variable and function names
- Keep functions small and focused on a single task

### File Naming

- React components: PascalCase (e.g., `BlockExplorer.js`)
- Utilities and helpers: camelCase (e.g., `chainAPI.js`)
- Constants: UPPER_SNAKE_CASE
- Use `.mjs` extension for ES modules in Node.js scripts

### Code Organization

- Group related functionality together
- Separate concerns (API, UI, business logic)
- Use the existing directory structure:
  - `app/src/components/` - React components
  - `app/src/app/` - Next.js pages and routes
  - `lib/` - Utility functions and API clients
  - `pages/api/` - API endpoints

### Comments and Documentation

- Add JSDoc comments for functions and classes
- Document complex business logic
- Explain "why" not "what" in comments
- Keep comments up-to-date with code changes

Example:
```javascript
/**
 * Decodes a rune name from its numeric value
 * @param {bigint} value - The numeric representation of the rune name
 * @returns {string} The decoded rune name
 */
function decodeRuneName(value) {
  // Implementation
}
```

### Error Handling

- Always handle errors appropriately
- Use try-catch blocks for async operations
- Provide meaningful error messages
- Log errors with context

```javascript
try {
  const data = await fetchBlockchainData();
  return data;
} catch (error) {
  console.error('Failed to fetch blockchain data:', error);
  throw new Error(`Blockchain data fetch failed: ${error.message}`);
}
```

### Security Guidelines

- Never commit sensitive data (API keys, passwords, private keys)
- Use environment variables for configuration
- Validate all user inputs
- Use parameterized queries for database operations
- Sanitize data before displaying in the UI

## Commit Message Guidelines

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, missing semi-colons, etc.)
- **refactor**: Code refactoring without changing functionality
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **chore**: Maintenance tasks, dependency updates

### Examples

```
feat(wallet): add Xverse wallet connection

Implement wallet connection using Xverse provider.
Includes balance display and transaction signing.

Closes #123
```

```
fix(api): prevent SQL injection in block query

Replace string concatenation with parameterized query
for block height lookup.
```

```
docs(readme): update installation instructions

Add prerequisites section and clarify environment
variable setup.
```

### Best Practices

- Use the imperative mood ("add" not "added")
- Keep subject line under 50 characters
- Capitalize the subject line
- Don't end the subject line with a period
- Separate subject from body with a blank line
- Wrap body at 72 characters
- Reference issues and pull requests in the footer

## Pull Request Process

### Before Submitting

1. **Update from upstream:**
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Test your changes:**
   - Ensure the application runs without errors
   - Test affected features manually
   - Add/update tests if applicable

3. **Lint your code:**
   ```bash
   npm run lint
   ```

4. **Review your changes:**
   ```bash
   git diff
   ```

### Submitting a Pull Request

1. Push your branch to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

2. Open a pull request on GitHub

3. Fill out the pull request template:
   - Describe what changes you made
   - Link related issues
   - Add screenshots for UI changes
   - List any breaking changes

4. Wait for review and address feedback

### Pull Request Guidelines

- Keep PRs focused and small
- One feature/fix per PR
- Write clear descriptions
- Include screenshots for visual changes
- Update documentation as needed
- Ensure CI checks pass

## Testing Guidelines

### Manual Testing

For now, the project uses manual testing. When testing your changes:

1. **Test the happy path:**
   - Verify the feature works as expected
   - Test with valid inputs

2. **Test edge cases:**
   - Empty inputs
   - Invalid data
   - Boundary conditions

3. **Test error scenarios:**
   - Network failures
   - Invalid API responses
   - Database connection issues

4. **Cross-browser testing (for UI changes):**
   - Chrome
   - Firefox
   - Safari

### Future: Automated Testing

When adding tests (planned):
- Write unit tests for utilities and helpers
- Write integration tests for API endpoints
- Write component tests for React components
- Aim for meaningful test coverage, not just high percentages

## Documentation

### Code Documentation

- Add JSDoc comments for public functions
- Document complex algorithms
- Explain Bitcoin/Runes protocol specifics
- Keep comments concise and relevant

### README and Guides

- Update README.md when adding features
- Document new environment variables
- Add examples for new functionality
- Keep documentation accurate and current

### API Documentation

When adding or modifying API endpoints:
- Document parameters and their types
- Provide example requests and responses
- Note any authentication requirements
- Document error responses

## Questions?

If you have questions about contributing:
- Open an issue with your question
- Reach out to the maintainers

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Help maintain a positive community

## License

By contributing to OdinPool, you agree that your contributions will be licensed under the same license as the project.

---

Thank you for contributing to OdinPool! 🚀
