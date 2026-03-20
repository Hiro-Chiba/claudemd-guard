import { ValidationResult } from '../contracts/types/ValidationResult';
import { ClaudeMdFile } from '../contracts/types/ClaudeMdFile';
import { IModelClient } from '../contracts/types/ModelClient';
import { validator } from '../validation/validator';
import { Config } from '../config/Config';
export interface CooldownStore {
    getLastTime(key: string): number;
    setLastTime(key: string, time: number): void;
}
export interface ProcessHookDataDeps {
    config?: Config;
    collectFn?: (cwd: string) => ClaudeMdFile[];
    validatorFn?: typeof validator;
    getModelClient?: (config: Config) => IModelClient;
    cooldownStore?: CooldownStore;
    cwd?: string;
}
export declare function processHookData(input: string, deps?: ProcessHookDataDeps): Promise<ValidationResult>;
//# sourceMappingURL=processHookData.d.ts.map