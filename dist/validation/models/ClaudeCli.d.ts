import { IModelClient } from '../../contracts/types/ModelClient';
import { Config } from '../../config/Config';
export declare class ClaudeCli implements IModelClient {
    private readonly config;
    private readonly cwd;
    constructor(config: Config, cwd?: string);
    ask(prompt: string): Promise<string>;
    private getClaudeBinary;
}
//# sourceMappingURL=ClaudeCli.d.ts.map