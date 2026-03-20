import { ValidationResult } from '../contracts/types/ValidationResult';
import { ClaudeMdFile } from '../contracts/types/ClaudeMdFile';
import { IModelClient } from '../contracts/types/ModelClient';
export declare function validator(claudeMdFiles: ClaudeMdFile[], toolName: string, toolInput: Record<string, unknown>, modelClient: IModelClient): Promise<ValidationResult>;
//# sourceMappingURL=validator.d.ts.map