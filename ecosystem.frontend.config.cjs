module.exports = {
  apps: [
    {
      name: 'frontend',
      script: 'npm',
      args: 'run dev',
      cwd: '/workspaces/Muhasabev2',
      env: {
        NODE_ENV: 'development'
      },
      watch: false,
      max_memory_restart: '1G',
      exp_backoff_restart_delay: 100,
      restart_delay: 5000,
      min_uptime: '10s',
      max_restarts: 10,
      autorestart: true,
      log_file: '/workspaces/Muhasabev2/logs/frontend.log',
      out_file: '/workspaces/Muhasabev2/logs/frontend-out.log',
      error_file: '/workspaces/Muhasabev2/logs/frontend-error.log',
      merge_logs: true,
      time: true
    }
  ]
};