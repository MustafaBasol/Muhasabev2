module.exports = {
  apps: [
    {
      name: 'moneyflow-backend',
      script: 'npm',
      args: 'run start:dev',
      cwd: './backend',
      env: {
        NODE_ENV: 'development',
        PORT: 3003
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
        NODE_ENV: 'development',
        VITE_API_URL: 'http://localhost:3003'
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