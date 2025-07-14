# Use specific Node version for better caching
FROM node:18-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install dependencies with optimizations
RUN npm ci --no-audit --no-fund && \
    npm install npm-run-all -g && \
    npm cache clean --force

# Copy application code
COPY . .

# Set environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Expose ports
EXPOSE 3000
EXPOSE 4001

# Use dumb-init as PID 1 for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Default command (can be overridden at runtime)
CMD ["npm", "start"]