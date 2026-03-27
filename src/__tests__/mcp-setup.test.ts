import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { createInterface } from 'node:readline';

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  access: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

vi.mock('node:util', () => ({
  promisify: (fn: unknown) => fn,
}));

// Readline mock: each test sets `mockAnswers` before calling setupServiceNowMcp
let mockAnswers: string[] = [];
let answerIndex = 0;

vi.mock('node:readline', () => ({
  createInterface: vi.fn(() => ({
    question: vi.fn((_prompt: string, cb: (answer: string) => void) => {
      cb(mockAnswers[answerIndex++] ?? '');
    }),
    close: vi.fn(),
  })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockAnswers = [];
  answerIndex = 0;
});

// Helper to import fresh each time (module is stateless, but keeps mocks clean)
async function runSetup() {
  const { setupServiceNowMcp } = await import('../mcp-setup.js');
  return setupServiceNowMcp();
}

describe('setupServiceNowMcp', () => {
  it('skips when user presses enter (empty instance name)', async () => {
    mockAnswers = [''];

    await runSetup();

    expect(vi.mocked(execFile)).not.toHaveBeenCalled();
    expect(vi.mocked(writeFile)).not.toHaveBeenCalled();
  });

  it('installs package when which fails', async () => {
    mockAnswers = ['myinstance', 'admin', 'secret123'];

    const mockedExecFile = vi.mocked(execFile);

    // 1st which: not found
    mockedExecFile.mockRejectedValueOnce(new Error('not found'));
    // npm install -g
    mockedExecFile.mockResolvedValueOnce({ stdout: '', stderr: '' } as never);
    // 2nd which: found after install
    mockedExecFile.mockResolvedValueOnce({ stdout: '/usr/local/bin/servicenow-mcp-server\n', stderr: '' } as never);
    // npm root -g
    mockedExecFile.mockResolvedValueOnce({ stdout: '/usr/local/lib/node_modules\n', stderr: '' } as never);

    vi.mocked(readFile).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
    vi.mocked(writeFile).mockResolvedValue(undefined);
    vi.mocked(mkdir).mockResolvedValue(undefined as never);

    await runSetup();

    // Verify npm install was called
    expect(mockedExecFile).toHaveBeenCalledWith('npm', ['install', '-g', 'servicenow-mcp-server']);
  });

  it('skips install when which succeeds', async () => {
    mockAnswers = ['myinstance', 'admin', 'secret123'];

    const mockedExecFile = vi.mocked(execFile);

    // 1st which: found
    mockedExecFile.mockResolvedValueOnce({ stdout: '/usr/local/bin/servicenow-mcp-server\n', stderr: '' } as never);
    // 2nd which (resolve path): found
    mockedExecFile.mockResolvedValueOnce({ stdout: '/usr/local/bin/servicenow-mcp-server\n', stderr: '' } as never);
    // npm root -g
    mockedExecFile.mockResolvedValueOnce({ stdout: '/usr/local/lib/node_modules\n', stderr: '' } as never);

    vi.mocked(readFile).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
    vi.mocked(writeFile).mockResolvedValue(undefined);
    vi.mocked(mkdir).mockResolvedValue(undefined as never);

    await runSetup();

    // npm install should NOT have been called
    expect(mockedExecFile).not.toHaveBeenCalledWith('npm', ['install', '-g', 'servicenow-mcp-server']);
  });

  it('writes config with correct JSON structure and 600 permissions', async () => {
    mockAnswers = ['dev12345', 'svcadmin', 'p@ssw0rd'];

    const mockedExecFile = vi.mocked(execFile);
    mockedExecFile.mockResolvedValueOnce({ stdout: '/usr/local/bin/servicenow-mcp-server\n', stderr: '' } as never);
    mockedExecFile.mockResolvedValueOnce({ stdout: '/usr/local/bin/servicenow-mcp-server\n', stderr: '' } as never);
    mockedExecFile.mockResolvedValueOnce({ stdout: '/usr/local/lib/node_modules\n', stderr: '' } as never);

    vi.mocked(readFile).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
    vi.mocked(writeFile).mockResolvedValue(undefined);
    vi.mocked(mkdir).mockResolvedValue(undefined as never);

    await runSetup();

    // Find the writeFile call for the config file
    const configCall = vi.mocked(writeFile).mock.calls.find(
      (call) => String(call[0]).endsWith('config/servicenow-instances.json')
    );

    expect(configCall).toBeDefined();
    const configJson = JSON.parse(configCall![1] as string);
    expect(configJson.instances).toHaveLength(1);
    expect(configJson.instances[0]).toEqual({
      name: 'dev12345',
      url: 'https://dev12345.service-now.com',
      username: 'svcadmin',
      password: 'p@ssw0rd',
      default: true,
    });
    expect(configCall![2]).toEqual({ encoding: 'utf-8', mode: 0o600 });
  });

  it('merges into existing .claude/settings.json without clobbering', async () => {
    mockAnswers = ['myinst', 'admin', 'pass'];

    const mockedExecFile = vi.mocked(execFile);
    mockedExecFile.mockResolvedValueOnce({ stdout: '/opt/bin/servicenow-mcp-server\n', stderr: '' } as never);
    mockedExecFile.mockResolvedValueOnce({ stdout: '/opt/bin/servicenow-mcp-server\n', stderr: '' } as never);
    mockedExecFile.mockResolvedValueOnce({ stdout: '/opt/lib/node_modules\n', stderr: '' } as never);

    const existingSettings = {
      permissions: { allow: ['npm'] },
      mcpServers: {
        'other-server': { command: '/bin/other', args: ['--flag'] },
      },
    };

    vi.mocked(readFile).mockImplementation(async (path: Parameters<typeof readFile>[0]) => {
      if (String(path).endsWith('settings.json')) {
        return JSON.stringify(existingSettings);
      }
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    });
    vi.mocked(writeFile).mockResolvedValue(undefined);
    vi.mocked(mkdir).mockResolvedValue(undefined as never);

    await runSetup();

    // Find the settings.json write
    const settingsCall = vi.mocked(writeFile).mock.calls.find(
      (call) => String(call[0]).endsWith('settings.json')
    );

    expect(settingsCall).toBeDefined();
    const settingsJson = JSON.parse(settingsCall![1] as string);

    // Existing keys preserved
    expect(settingsJson.permissions).toEqual({ allow: ['npm'] });
    expect(settingsJson.mcpServers['other-server']).toEqual({ command: '/bin/other', args: ['--flag'] });
    // New key added
    expect(settingsJson.mcpServers.servicenow).toEqual({
      command: '/opt/bin/servicenow-mcp-server',
      args: [],
    });
  });

  it('creates new .claude/settings.json when absent', async () => {
    mockAnswers = ['myinst', 'admin', 'pass'];

    const mockedExecFile = vi.mocked(execFile);
    mockedExecFile.mockResolvedValueOnce({ stdout: '/usr/bin/servicenow-mcp-server\n', stderr: '' } as never);
    mockedExecFile.mockResolvedValueOnce({ stdout: '/usr/bin/servicenow-mcp-server\n', stderr: '' } as never);
    mockedExecFile.mockResolvedValueOnce({ stdout: '/usr/lib/node_modules\n', stderr: '' } as never);

    vi.mocked(readFile).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
    vi.mocked(writeFile).mockResolvedValue(undefined);
    vi.mocked(mkdir).mockResolvedValue(undefined as never);

    await runSetup();

    const settingsCall = vi.mocked(writeFile).mock.calls.find(
      (call) => String(call[0]).endsWith('settings.json')
    );

    expect(settingsCall).toBeDefined();
    const settingsJson = JSON.parse(settingsCall![1] as string);
    expect(settingsJson).toEqual({
      mcpServers: {
        servicenow: {
          command: '/usr/bin/servicenow-mcp-server',
          args: [],
        },
      },
    });
  });

  it('appends to .gitignore when entry missing', async () => {
    mockAnswers = ['myinst', 'admin', 'pass'];

    const mockedExecFile = vi.mocked(execFile);
    mockedExecFile.mockResolvedValueOnce({ stdout: '/usr/bin/servicenow-mcp-server\n', stderr: '' } as never);
    mockedExecFile.mockResolvedValueOnce({ stdout: '/usr/bin/servicenow-mcp-server\n', stderr: '' } as never);
    mockedExecFile.mockResolvedValueOnce({ stdout: '/usr/lib/node_modules\n', stderr: '' } as never);

    vi.mocked(readFile).mockImplementation(async (path: Parameters<typeof readFile>[0]) => {
      if (String(path).endsWith('.gitignore')) {
        return 'node_modules\ndist\n';
      }
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    });
    vi.mocked(writeFile).mockResolvedValue(undefined);
    vi.mocked(mkdir).mockResolvedValue(undefined as never);

    await runSetup();

    const gitignoreCall = vi.mocked(writeFile).mock.calls.find(
      (call) => String(call[0]).endsWith('.gitignore')
    );

    expect(gitignoreCall).toBeDefined();
    const content = gitignoreCall![1] as string;
    expect(content).toContain('.claude/settings.json');
    expect(content).toContain('node_modules');
  });

  it('skips .gitignore append when entry already present', async () => {
    mockAnswers = ['myinst', 'admin', 'pass'];

    const mockedExecFile = vi.mocked(execFile);
    mockedExecFile.mockResolvedValueOnce({ stdout: '/usr/bin/servicenow-mcp-server\n', stderr: '' } as never);
    mockedExecFile.mockResolvedValueOnce({ stdout: '/usr/bin/servicenow-mcp-server\n', stderr: '' } as never);
    mockedExecFile.mockResolvedValueOnce({ stdout: '/usr/lib/node_modules\n', stderr: '' } as never);

    vi.mocked(readFile).mockImplementation(async (path: Parameters<typeof readFile>[0]) => {
      if (String(path).endsWith('.gitignore')) {
        return 'node_modules\n.claude/settings.json\ndist\n';
      }
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    });
    vi.mocked(writeFile).mockResolvedValue(undefined);
    vi.mocked(mkdir).mockResolvedValue(undefined as never);

    await runSetup();

    const gitignoreCall = vi.mocked(writeFile).mock.calls.find(
      (call) => String(call[0]).endsWith('.gitignore')
    );

    // Should not write .gitignore since entry already present
    expect(gitignoreCall).toBeUndefined();
  });

  it('uses absolute binary path in settings', async () => {
    mockAnswers = ['myinst', 'admin', 'pass'];

    const mockedExecFile = vi.mocked(execFile);
    mockedExecFile.mockResolvedValueOnce({ stdout: '/home/user/.nvm/versions/node/v20/bin/servicenow-mcp-server\n', stderr: '' } as never);
    mockedExecFile.mockResolvedValueOnce({ stdout: '/home/user/.nvm/versions/node/v20/bin/servicenow-mcp-server\n', stderr: '' } as never);
    mockedExecFile.mockResolvedValueOnce({ stdout: '/home/user/.nvm/versions/node/v20/lib/node_modules\n', stderr: '' } as never);

    vi.mocked(readFile).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
    vi.mocked(writeFile).mockResolvedValue(undefined);
    vi.mocked(mkdir).mockResolvedValue(undefined as never);

    await runSetup();

    const settingsCall = vi.mocked(writeFile).mock.calls.find(
      (call) => String(call[0]).endsWith('settings.json')
    );

    expect(settingsCall).toBeDefined();
    const settingsJson = JSON.parse(settingsCall![1] as string);
    expect(settingsJson.mcpServers.servicenow.command).toBe(
      '/home/user/.nvm/versions/node/v20/bin/servicenow-mcp-server'
    );
  });
});
