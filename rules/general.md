# General Project Rules

## Technology Stack

- **Runtime**: Bun (primary package manager and runtime)
- **Language**: TypeScript with strict type checking
- **Testing**: Bun's built-in test runner
- **Benchmarking**: Custom benchmark suite in `benchmarks/`
- **Linting**: Oxlint (`.oxlintrc.json`)
- **Formatting**: Oxfmt (`.oxfmtrc.json`)

## Code Quality Standards

### Naming Conventions

- Use kebab-case for file names
- Use PascalCase for class names and types
- Use camelCase for variables and functions
- Use SCREAMING_SNAKE_CASE for constants

### File Organization

- Keep source code in `src/` (implied from package structure)
- Place examples in `examples/` with numbered directories
- Store fixtures in `fixtures/` with organized subdirectories
- Use `.agents/` for AI-specific documentation and plans

## Git Workflow

### Commit Messages

- Use Conventional Commits format
- Husky pre-commit hooks enforce standards
- Lint-staged runs on staged files

### Branch Strategy

- Feature branches for new implementations
- Follow the numbered plan system in `.agents/plans/`

## Testing Strategy

### Test Structure

- Use Bun's built-in testing framework
- Comprehensive benchmark suite for performance tracking
- Test fixtures organized by category in `fixtures/`

### Performance

- Run benchmarks via GitHub Actions
- Compare performance on PRs
- Monitor key operations (loading, saving, drawing, forms)

## Documentation Standards

### Code Documentation

- Use TSDoc comments for public APIs
- Maintain examples for all major features
- Keep README.md files in subdirectories

### Architecture Documentation

- Use `.agents/` directory for AI collaboration
- Maintain implementation plans in `plans/`
- Document research in `scratch/`
- Keep STATUS.md updated with current progress

## Security Practices

### PDF Security

- Handle encrypted PDFs properly
- Implement proper signature validation
- Validate input files before processing
- Use secure random generation for cryptographic operations

### Dependencies

- Keep dependencies minimal and audited
- Use Bun's security features
- Regular security updates via dependabot

## Development Workflow

### Environment Setup

- Use `.env.example` as template
- Configure VS Code with provided settings
- Use recommended extensions from `.vscode/extensions.json`

### AI Integration

- Follow `.agents/` documentation structure
- Use OpenCode commands for consistency
- Maintain skills directory for reusable AI patterns

### Release Process

- Automated releases via GitHub Actions
- Semantic versioning
- Comprehensive changelog maintenance
