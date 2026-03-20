export declare const DEFAULT_MODEL = "claude-sonnet-4-6";
export type ConfigOptions = {
    model?: string;
    apiKey?: string;
    cooldown?: number;
    disabled?: boolean;
    useSystemClaude?: boolean;
};
export declare class Config {
    readonly model: string;
    readonly apiKey: string | undefined;
    readonly cooldown: number;
    readonly disabled: boolean;
    readonly useSystemClaude: boolean;
    constructor(options?: ConfigOptions);
    get useApi(): boolean;
}
//# sourceMappingURL=Config.d.ts.map