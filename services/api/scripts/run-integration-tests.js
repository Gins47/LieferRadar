const { randomBytes } = require('node:crypto');
const { spawn } = require('node:child_process');
const path = require('node:path');

const apiDirectory = path.resolve(__dirname, '..');
const repositoryDirectory = path.resolve(apiDirectory, '..', '..');
const composeFile = path.join(apiDirectory, 'docker-compose.test.yaml');
const verifyCleanup = process.argv.includes('--verify-cleanup');
const cleanupOnly = process.argv.includes('--cleanup-only');

let activeChild;
let activeProject;
let activeComposeEnvironment;
let cleanupStarted = false;

function fail(message) {
  throw new Error(`Integration test setup failed: ${message}`);
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? apiDirectory,
      env: options.env ?? process.env,
      stdio: options.captureOutput ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });
    activeChild = child;

    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code, signal) => {
      activeChild = undefined;
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }
      reject(
        new Error(
          `${command} ${args.join(' ')} failed${signal ? ` (${signal})` : ''}${
            stderr ? `: ${stderr.trim()}` : ''
          }`,
        ),
      );
    });
  });
}

function testEnvironment(context) {
  const environment = { ...process.env };
  for (const key of [
    'DATABASE_URL',
    'PGHOST',
    'PGPORT',
    'PGDATABASE',
    'PGUSER',
    'PGPASSWORD',
  ]) {
    delete environment[key];
  }

  return {
    ...environment,
    LIEFERRADAR_TEST_CONTEXT: 'ephemeral-postgres',
    LIEFERRADAR_TEST_RUN_ID: context.runId,
    LIEFERRADAR_TEST_DATABASE_URL: context.databaseUrl,
    LIEFERRADAR_TEST_DATABASE_NAME: context.databaseName,
    LIEFERRADAR_TEST_COMPOSE_PROJECT: context.project,
  };
}

function composeArguments(project, args) {
  return ['compose', '--project-name', project, '--file', composeFile, ...args];
}

async function removeProject(project, composeEnvironment) {
  if (!project || cleanupStarted) {
    return;
  }
  cleanupStarted = true;
  try {
    await run('docker', composeArguments(project, ['down', '--volumes', '--remove-orphans']), {
      cwd: repositoryDirectory,
      env: composeEnvironment,
    });
  } finally {
    cleanupStarted = false;
  }
}

async function assertProjectRemoved(project, composeEnvironment) {
  const remaining = await run(
    'docker',
    composeArguments(project, ['ps', '--all', '--quiet']),
    { cwd: repositoryDirectory, env: composeEnvironment, captureOutput: true },
  );
  if (remaining) {
    fail(`test Compose project ${project} still has containers after cleanup`);
  }

  const volumes = await run(
    'docker',
    ['volume', 'ls', '--quiet', '--filter', `label=com.docker.compose.project=${project}`],
    { captureOutput: true },
  );
  if (volumes) {
    fail(`test Compose project ${project} still has volumes after cleanup`);
  }

  const networks = await run(
    'docker',
    ['network', 'ls', '--quiet', '--filter', `label=com.docker.compose.project=${project}`],
    { captureOutput: true },
  );
  if (networks) {
    fail(`test Compose project ${project} still has networks after cleanup`);
  }
}

async function runWorkflow({ injectFailure = false } = {}) {
  const token = `${process.pid}${randomBytes(4).toString('hex')}`;
  const project = `lieferradar-test-${token}`;
  const databaseName = `lieferradar_test_${token}`;
  const databaseUser = `lr_test_${token}`;
  const databasePassword = randomBytes(24).toString('hex');
  const composeEnvironment = {
    ...process.env,
    LIEFERRADAR_TEST_DB_NAME: databaseName,
    LIEFERRADAR_TEST_DB_USER: databaseUser,
    LIEFERRADAR_TEST_DB_PASSWORD: databasePassword,
  };

  activeProject = project;
  activeComposeEnvironment = composeEnvironment;
  let workflowError;

  try {
    await run(
      'docker',
      composeArguments(project, ['up', '--wait', '--wait-timeout', '60']),
      { cwd: repositoryDirectory, env: composeEnvironment },
    );

    const containerId = await run(
      'docker',
      composeArguments(project, ['ps', '--quiet', 'postgres']),
      { cwd: repositoryDirectory, env: composeEnvironment, captureOutput: true },
    );
    if (!containerId) {
      fail('the test PostgreSQL container was not created');
    }
    const owner = await run(
      'docker',
      [
        'inspect',
        '--format',
        '{{ index .Config.Labels "com.docker.compose.project" }}',
        containerId,
      ],
      { captureOutput: true },
    );
    if (owner !== project) {
      fail('the PostgreSQL container does not belong to this test project');
    }
    const endpoint = await run(
      'docker',
      composeArguments(project, ['port', 'postgres', '5432']),
      { cwd: repositoryDirectory, env: composeEnvironment, captureOutput: true },
    );
    const port = endpoint.match(/:(\d+)$/)?.[1];
    if (!port || port === '5432') {
      fail('the test PostgreSQL container does not have an isolated dynamic port');
    }

    const databaseUrl = `postgresql://${databaseUser}:${databasePassword}@127.0.0.1:${port}/${databaseName}`;
    const context = { runId: token, project, databaseName, databaseUrl };
    const migrationEnvironment = {
      ...testEnvironment(context),
      DATABASE_URL: databaseUrl,
    };

    await run('npm', ['run', 'migrate:up'], { env: migrationEnvironment });

    const environment = testEnvironment(context);
    if (injectFailure) {
      try {
        await run('node', ['-e', 'process.exit(1)'], { env: environment });
      } catch {
        throw new Error('controlled cleanup probe failure');
      }
      fail('the controlled cleanup probe unexpectedly passed');
    }

    await run('npm', ['run', 'test:db'], { env: environment });
    await run('npm', ['run', 'test:e2e', '--', '--runInBand'], { env: environment });
  } catch (error) {
    workflowError = error;
  } finally {
    try {
      await removeProject(project, composeEnvironment);
      await assertProjectRemoved(project, composeEnvironment);
    } catch (cleanupError) {
      const originalError = workflowError ? ` after ${workflowError.message}` : '';
      workflowError = new Error(
        `test project cleanup failed${originalError}: ${cleanupError.message}`,
      );
    }
    activeProject = undefined;
    activeComposeEnvironment = undefined;
  }

  if (workflowError) {
    throw workflowError;
  }
}

async function main() {
  if (!cleanupOnly) {
    await runWorkflow();
  }
  if (verifyCleanup) {
    try {
      await runWorkflow({ injectFailure: true });
      fail('the controlled failure workflow unexpectedly passed');
    } catch (error) {
      if (error.message !== 'controlled cleanup probe failure') {
        throw error;
      }
      process.stdout.write('Verified cleanup after a controlled failure.\n');
    }
  }
}

async function shutdown(signal) {
  activeChild?.kill('SIGTERM');
  try {
    await removeProject(activeProject, activeComposeEnvironment);
  } finally {
    process.exit(signal === 'SIGINT' ? 130 : 143);
  }
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
