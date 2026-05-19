import { describe, expect, it, vi } from 'vitest';
import { MonitorController } from '../../src/modules/monitor/monitor.controller';
import type { MonitorService } from '../../src/modules/monitor/monitor.service';

describe('MonitorController', () => {
  it('delegates order status refresh to the monitor service', async () => {
    const result = {
      runId: 'sync_run_1',
      jobType: 'order_status_refresh',
      status: 'failed',
      capability: 'unavailable',
    };
    const controller = new MonitorController({
      refreshOrderStatuses: vi.fn().mockResolvedValue(result),
    } as unknown as MonitorService);

    await expect(controller.refreshOrderStatuses()).resolves.toBe(result);
  });

  it('delegates script market refresh to the monitor service', async () => {
    const result = {
      runId: 'sync_run_2',
      jobType: 'script_market_refresh',
      status: 'failed',
      capability: 'unavailable',
    };
    const controller = new MonitorController({
      refreshScriptMarkets: vi.fn().mockResolvedValue(result),
    } as unknown as MonitorService);

    await expect(controller.refreshScriptMarkets()).resolves.toBe(result);
  });
});
