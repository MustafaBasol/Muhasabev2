module.exports = {
  apps: [
    {
      name: 'moneyflow-backend',
      cwd: './backend',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      max_memory_restart: '1G',
      restart_delay: 2000,
      max_restarts: 10,
      min_uptime: '10s',
      watch: false,
      ignore_watch: ['node_modules', 'logs'],
      log_file: '../logs/backend.log',
      error_file: '../logs/backend-error.log',
      out_file: '../logs/backend-out.log',
      time: true
    },
    {
      name: 'moneyflow-frontend',
      cwd: './',
      script: 'npm',
      args: 'run dev',
      env: {
        NODE_ENV: 'development',
        PORT: 5174
      },
      max_memory_restart: '500M',
      restart_delay: 2000,
      max_restarts: 10,
      min_uptime: '10s',
      watch: false,
      ignore_watch: ['node_modules', 'dist', 'logs'],
      log_file: './logs/frontend.log',
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      time: true
    }
  ]
};