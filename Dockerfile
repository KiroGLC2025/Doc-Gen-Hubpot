# GLC Deal Generator — Node + LibreOffice, for Render (Docker web service)
FROM node:20-bookworm-slim

# LibreOffice Writer is all that's needed for .docx -> .pdf.
# Carlito = metric-compatible stand-in for Calibri (body font).
RUN apt-get update && apt-get install -y --no-install-recommends \
      libreoffice-writer \
      fonts-crosextra-carlito \
      fontconfig \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Brand fonts for exact fidelity. Drop your licensed Georgia*.ttf and Calibri*.ttf
# into ./fonts before building (see fonts/README.txt). Safe if the folder is empty.
COPY fonts/ /usr/share/fonts/truetype/glc/
RUN fc-cache -f

# Dependencies (includes tsx, which runs the TypeScript service directly — no build step).
COPY package.json package-lock.json ./
RUN npm install

# Service code + the tokenised template (read at runtime from ./templates).
COPY tsconfig.json ./
COPY src/ ./src/
COPY templates/letter-of-offer.template.docx ./templates/

# LibreOffice needs a writable HOME for its profile.
ENV HOME=/tmp
ENV NODE_ENV=production

# Render injects PORT; the server binds to it (falls back to 8080 locally).
EXPOSE 8080
CMD ["npx", "tsx", "src/server.ts"]
