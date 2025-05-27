#!/bin/bash

# Create logs directory if it doesn't exist
mkdir -p logs

# Start the application with PM2
if [ "$NODE_ENV" = "production" ]; then
  pm2 start ecosystem.config.js --env production
else
  pm2 start ecosystem.config.js --env development
fi

# Save the PM2 process list
pm2 save

# Display logs
pm2 logs 