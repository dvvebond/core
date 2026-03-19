# Frontend Rules

## Framework: Next.js + React + TypeScript

### Project Structure

- Use App Router (`app/` directory) for routing
- Place components in `components/` directory with clear categorization
- Keep MDX components and content separate from React components
- Use TypeScript for all frontend code (.tsx, .ts)

### Component Conventions

- Use React Server Components by default
- Export components as default exports
- Use kebab-case for file names (e.g., `mdx-link.tsx`)
- Place shared utilities in `lib/` directory
- Use the `cn()` utility for className merging

### Styling System

- Use Tailwind CSS for styling (configured via `postcss.config.mjs`)
- Global styles in `global.css`
- Follow utility-first approach
- Use CSS custom properties for theming

### Documentation Site Patterns

- Use Fumadocs for documentation framework
- MDX files in `content/docs/` with proper frontmatter
- Use `meta.json` files for navigation configuration
- Implement proper source configuration in `source.config.ts`

### Common Mistakes to Avoid

- Don't mix Client and Server Components incorrectly
- Don't forget to add proper TypeScript types
- Don't ignore Next.js performance best practices
- Don't hardcode content - use the MDX system
