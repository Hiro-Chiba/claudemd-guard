import { Config } from '../../config/Config';
import { IModelClient } from '../../contracts/types/ModelClient';
export declare class AnthropicApi implements IModelClient {
    private readonly config;
    private readonly client;
    constructor(config: Config);
    ask(prompt: string): Promise<string>;
}
//# sourceMappingURL=AnthropicApi.d.ts.map