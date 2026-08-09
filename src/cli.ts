export interface CliOptions {
  http: boolean;
  readOnly: boolean;
  port: number;
  host: string;
  longhornUrl: string;
  allowedHosts: string[];
}

export const DEFAULTS: CliOptions = {
  http: false,
  readOnly: false,
  port: 3000,
  host: '0.0.0.0',
  // Standard Kubernetes cluster-local DNS — works out of the box on any
  // cluster. A cluster with a custom cluster domain overrides this via
  // --longhorn-url in its own Deployment, rather than baking a
  // cluster-specific suffix into this package's default.
  longhornUrl: 'http://longhorn-backend.longhorn-system.svc.cluster.local:9500',
  allowedHosts: ['localhost', '127.0.0.1'],
};

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function nextValue(argv: string[], i: number, flag: string): string {
  const value = argv[i];
  if (value === undefined) throw new Error(`${flag} requires a value`);
  return value;
}

/** Parses process.argv.slice(2)-style args. Unknown flags are ignored. */
export function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { ...DEFAULTS, allowedHosts: [...DEFAULTS.allowedHosts] };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--http') {
      options.http = true;
    } else if (arg === '--read-only') {
      options.readOnly = true;
    } else if (arg === '--port') {
      options.port = Number(nextValue(argv, ++i, '--port'));
    } else if (arg.startsWith('--port=')) {
      options.port = Number(arg.slice('--port='.length));
    } else if (arg === '--host') {
      options.host = nextValue(argv, ++i, '--host');
    } else if (arg.startsWith('--host=')) {
      options.host = arg.slice('--host='.length);
    } else if (arg === '--longhorn-url') {
      options.longhornUrl = nextValue(argv, ++i, '--longhorn-url');
    } else if (arg.startsWith('--longhorn-url=')) {
      options.longhornUrl = arg.slice('--longhorn-url='.length);
    } else if (arg === '--allowed-hosts') {
      options.allowedHosts = splitList(nextValue(argv, ++i, '--allowed-hosts'));
    } else if (arg.startsWith('--allowed-hosts=')) {
      options.allowedHosts = splitList(arg.slice('--allowed-hosts='.length));
    }
  }

  return options;
}
