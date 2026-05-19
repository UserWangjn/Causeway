import { afterEach, describe, expect, it } from 'vitest';
import { getTestDatabaseUrl } from '../support/prisma-test-client';

const originalNodeEnv = process.env.NODE_ENV;
const originalTestDatabaseUrl = process.env.TEST_DATABASE_URL;

describe('getTestDatabaseUrl', () => {
  afterEach(() => {
    restoreEnv();
  });

  it('requires NODE_ENV=test', () => {
    process.env.NODE_ENV = 'development';
    process.env.TEST_DATABASE_URL = 'postgresql://user:pass@localhost:5432/causeway_test?schema=public';

    expect(() => getTestDatabaseUrl()).toThrow('NODE_ENV=test is required');
  });

  it('requires the database name itself to be the test database', () => {
    process.env.NODE_ENV = 'test';
    process.env.TEST_DATABASE_URL = 'postgresql://causeway_test:pass@localhost:5432/causeway?schema=public';

    expect(() => getTestDatabaseUrl()).toThrow('database name must be exactly');
  });

  it('accepts an explicit test database name', () => {
    process.env.NODE_ENV = 'test';
    process.env.TEST_DATABASE_URL = 'postgresql://user:pass@localhost:5432/causeway_test?schema=public';

    expect(getTestDatabaseUrl()).toBe(process.env.TEST_DATABASE_URL);
  });
});

function restoreEnv(): void {
  if (originalNodeEnv == null) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }

  if (originalTestDatabaseUrl == null) {
    delete process.env.TEST_DATABASE_URL;
  } else {
    process.env.TEST_DATABASE_URL = originalTestDatabaseUrl;
  }
}
