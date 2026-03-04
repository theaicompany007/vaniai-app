FROM node:20-alpine AS builder
WORKDIR /app

# Next.js needs NEXT_PUBLIC_* at build time (they get inlined). Pass from docker-compose build args.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

# Placeholders so modules that read env at load time (e.g. kb.ts, agents.ts, email.ts) don't throw during "Collecting page data".
# Real values come from env_file: .env at runtime.
ENV OPENAI_API_KEY=build-placeholder
ENV ANTHROPIC_API_KEY=build-placeholder
ENV GOOGLE_AI_API_KEY=build-placeholder
ENV PERPLEXITY_API_KEY=build-placeholder
ENV SUPABASE_SERVICE_ROLE_KEY=build-placeholder
ENV RESEND_API_KEY=build-placeholder

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ──────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache wget

ENV NODE_ENV=production
ENV PORT=3100

# Listen on all interfaces so GCP load balancer health checks (to instance internal IP) can reach the app.
# Docker can set HOSTNAME to the container name; force 0.0.0.0 in CMD so the Next.js server always binds to all interfaces.
# Copy standalone build output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3100

CMD ["sh", "-c", "HOSTNAME=0.0.0.0 exec node server.js"]
