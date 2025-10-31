module.exports = {
  apps: [
    {
      name: 'moneyflow-backend',
      cwd: '/workspaces/Muhasabev2/backend',
      script: 'npm',
      args: 'start',
      interpreter: 'none',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      watch: false,
      max_memory_restart: '1G',
      restart_delay: 1000,
      max_restarts: 10,
      min_uptime: '10s',
      error_file: '/workspaces/Muhasabev2/logs/backend-error.log',
      out_file: '/workspaces/Muhasabev2/logs/backend-out.log',
      log_file: '/workspaces/Muhasabev2/logs/backend-combined.log',
      time: true
    },
    {
      name: 'moneyflow-frontend',
      cwd: '/workspaces/Muhasabev2',
      script: 'npm',
      args: 'run dev',
      interpreter: 'none',
      env: {
        NODE_ENV: 'development',
        PORT: 5174
      },
      watch: false,
      max_memory_restart: '500M',
      restart_delay: 1000,
      max_restarts: 10,
      min_uptime: '10s',
      error_file: '/workspaces/Muhasabev2/logs/frontend-error.log',
      out_file: '/workspaces/Muhasabev2/logs/frontend-out.log',
      log_file: '/workspaces/Muhasabev2/logs/frontend-combined.log',
      time: true
    }
  ]
};
