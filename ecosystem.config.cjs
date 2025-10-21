module.exports = {
  apps: [
    {
      name: 'backend',
      cwd: './backend',
      script: 'npm',
      args: 'run start:dev',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 2000,
      env: {
        NODE_ENV: 'development',
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
    {
      name: 'frontend',
      cwd: './',
      script: 'npm',
      args: 'run dev',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 2000,
      env: {
        NODE_ENV: 'development',
      },
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
