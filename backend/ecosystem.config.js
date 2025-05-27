module.exports = {
  apps: [{
    name: 'express-backend',
    script: 'src/server.js',
    instances: 'max', // Use all available CPU cores
    exec_mode: 'cluster', // Run in cluster mode
    watch: true, // Enable watch mode in development
    ignore_watch: ['node_modules', 'logs'], // Ignore these directories
    max_memory_restart: '1G', // Restart if memory exceeds 1GB
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_development: {
      NODE_ENV: 'development',
      PORT: 3000,
      watch: true, // Enable watch mode in development
      watch_options: {
        followSymlinks: false,
        usePolling: true // Better for Docker
      }
    },
    // PM2 will automatically restart the app if it crashes
    autorestart: true,
    // Wait 1 second before restarting
    restart_delay: 1000,
    // Log files
    error_file: 'logs/err.log',
    out_file: 'logs/out.log',
    // Merge logs from all instances
    merge_logs: true,
    // Log format
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    // Metrics
    metrics: {
      http: true,
      custom: {
        'active_users': {
          type: 'gauge',
          help: 'Number of active users'
        }
      }
    }
  }]
}; 