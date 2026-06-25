import { config } from 'dotenv';
import path from 'path';

export function setup() {
  config({ path: path.resolve(process.cwd(), '.env') });
}
