module.exports = {
  apps: [
    {
      name: 'moneyflow-backend',
      script: 'npm',
      args: 'run start:dev',
      cwd: './backend',
      env: {
        NODE_ENV: 'development',
        PORT: 3001,
        DATABASE_HOST: 'localhost',
        DATABASE_PORT: 5433,
        DATABASE_USER: 'moneyflow',
        DATABASE_PASSWORD: 'moneyflow123',
        DATABASE_NAME: 'moneyflow_dev'
      },
      watch: false, // Nest zaten watch yapıyor
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000,
      log_file: './logs/backend.log',
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      pid_file: './logs/backend.pid'
    },
    {
      name: 'moneyflow-frontend',
      script: 'npm',
      args: 'run dev',
      cwd: './',
      env: {
        NODE_ENV: 'development'
      },
      watch: false, // Vite zaten watch yapıyor
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000,
      log_file: './logs/frontend.log',
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      pid_file: './logs/frontend.pid'
    }
  ]
};