FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Create logs directory
RUN mkdir -p logs

# Expose the port
EXPOSE 3000

# Start the application with PM2
CMD ["npm", "run", "pm2:start"] 