FROM nginx:alpine

# Copy static files
COPY public /usr/share/nginx/html

# Copy nginx configuration for static file serving
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"] 