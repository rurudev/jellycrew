@AGENTS.md

## Stack (verified from package.json and pnpm-lock.yaml, 2026-09-11)

- Next.js 16.3.4 (App Router, `output: "standalone"`, Turbopack; `proxy.ts` instead of middleware, `PageProps`/`LayoutProps` helper types, async `params`/`searchParams`)
- React 19.2.8 / react-dom 19.2.8 (`useActionState`, server actions)
- TypeScript 5.9.3, strict
- Tailwind CSS 4.3.3 via `@tailwindcss/postcss` (CSS-first config in `app/globals.css`; no `tailwind.config`)
- shadcn/ui 4.21 (Base UI `@base-ui/react`, "nova" preset, `components.json`) copied into `components/ui`; add components with `pnpm dlx shadcn@latest add <name>`; icons from `lucide-react`; `cn` from the `cn` package (clsx + tailwind-merge)
- Fonts: Geist Sans and Geist Mono via `next/font/google`
- zod 4.6.1, vitest 5.0.0, eslint 9.39.5 (`eslint-config-next`), drizzle-orm 0.45.2 on better-sqlite3, iron-session 9.0.1
- Node ≥ 22, pnpm 12.3.4

## Design work

The UI redesign is documented in `docs/design/`: `audit.md` (findings), `direction.md` (design system and screen direction), `plan.md` (work packages, once approved). Read `direction.md` before touching any UI.
