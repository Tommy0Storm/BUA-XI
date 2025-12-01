# Code Style & Conventions

## TypeScript Conventions
- Use strict TypeScript with proper type annotations
- Prefer interfaces over type aliases for object shapes
- Use `as any` sparingly and only when interfacing with external APIs

## React Patterns
- Functional components with hooks only (no class components)
- Use `useRef` for values that shouldn't trigger re-renders
- Use `useCallback` for stable function references passed to children
- Use `useMemo` for expensive computations

## Naming Conventions
- **Components**: PascalCase (`ChatWidget.tsx`, `LiveConsole.tsx`)
- **Hooks**: camelCase with `use` prefix (`useGeminiLive.ts`)
- **Utils**: camelCase (`audioUtils.ts`, `consoleUtils.ts`)
- **Refs**: camelCase with `Ref` suffix (`sessionRef`, `isConnectedRef`)
- **Constants**: SCREAMING_SNAKE_CASE (`AUDIO_CONFIG`, `MODELS`)

## File Organization
```
bua-x1/
├── components/     # React UI components
├── hooks/          # Custom React hooks
├── services/       # External service integrations
├── personas/       # AI persona definitions
├── utils/          # Utility functions
├── src/            # Additional source files
│   ├── debug/      # Debug utilities
│   └── pages/      # Page components
└── public/         # Static assets
```

## Import Order
1. React and external libraries
2. Local components
3. Hooks
4. Services
5. Utils
6. Types
7. Constants

## Comments & Documentation
- Use JSDoc for exported functions
- Inline comments for complex logic
- TODO comments with context for future work
