declare module "@dr.pogodin/react-native-static-server" {
  export type StaticServerState = "ACTIVE" | "CRASHED" | "INACTIVE" | "STARTING" | "STOPPING";

  export type StaticServerOptions = {
    fileDir: string;
    hostname?: string;
    port?: number;
    nonLocal?: boolean;
    stopInBackground?: boolean | number;
    extraConfig?: string;
    errorLog?: boolean | Record<string, unknown>;
    id?: number;
    state?: StaticServerState;
  };

  export default class Server {
    constructor(options: StaticServerOptions);
    readonly fileDir: string;
    readonly hostname: string;
    readonly origin: string;
    readonly port: number;
    readonly state: StaticServerState;
    start(details?: string): Promise<string>;
    stop(details?: string): Promise<void>;
    addStateListener?(listener: (state: string, details: string, error?: Error) => void): () => void;
    removeAllStateListeners?(): void;
  }

  export function extractBundledAssets(into?: string, from?: string): Promise<void>;
  export function getActiveServer(): Server | undefined;
  export function resolveAssetsPath(path: string): string;
}
