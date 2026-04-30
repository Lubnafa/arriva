import { initLogger } from '../src/utils/logger';
import { createTestEnv } from './helpers/testEnv';

beforeAll(() => {
  initLogger(createTestEnv({ LOG_LEVEL: 'error' }), '1.0.0-test');
});
