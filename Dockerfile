FROM node:18-alpine

WORKDIR /app

# Copy static files
COPY index.html .
COPY app.jsx .

# Install serve globally for serving static content
RUN npm install -g serve

EXPOSE 1234

CMD ["serve", "-s", ".", "-l", "1234"]
