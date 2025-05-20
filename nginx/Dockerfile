FROM nginx:alpine

# Copy static files from frontend
COPY frontend/public /usr/share/nginx/html

# Copy nginx configuration
COPY nginx/nginx.conf /etc/nginx

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"] 