# Contributing to Mercora

Thank you for helping improve Mercora. Contributions that make the platform
safer, more reusable, easier to operate, or useful to a broader range of
merchants are welcome.

## Before You Start

- Open an issue before beginning a large feature or architectural change.
- Keep pull requests focused on one coherent capability or invariant.
- Do not include merchant-specific content, credentials, customer data, or
  production infrastructure identifiers.
- Report security vulnerabilities privately as described in
  [SECURITY.md](SECURITY.md).

## Development Workflow

1. Create a topic branch from the latest `main`.
2. Install dependencies with `npm ci`.
3. Make the smallest complete change that addresses the issue.
4. Add or update tests when test coverage exists for the affected behavior.
5. Update relevant documentation and database migrations.
6. Run the available validation commands:

   ```bash
   npm run lint
   npm run typecheck
   npm run build
   ```

7. Open a pull request explaining what changed, why it changed, and how it was
   verified.

## Pull Request Expectations

A pull request should:

- Preserve Mercora's merchant-neutral configuration and default demo behavior.
- Describe deployment, environment, or migration impact.
- Avoid mixing unrelated refactors with functional changes.
- Pass the repository's required CI checks.

## License

By contributing to Mercora, you agree that your contributions will be licensed
under the project's [MIT License](LICENSE).
