import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../src/database/prisma.service';
import { MonitorService } from '../../src/modules/monitor/monitor.service';

describe('MonitorService', () => {
  it('records an unavailable capability run for order status refresh', async () => {
    const syncRunCreate = vi.fn().mockResolvedValue({
      id: 'sync_run_1',
      jobType: 'order_status_refresh',
      status: 'failed',
    });
    const service = new MonitorService({
      syncRun: {
        create: syncRunCreate,
      },
    } as unknown as PrismaService);

    const result = await service.refreshOrderStatuses();

    expect(syncRunCreate).toHaveBeenCalledWith({
      data: {
        jobType: 'order_status_refresh',
        scope: 'orders',
        status: 'failed',
        finishedAt: expect.any(Date) as Date,
        error: 'CLOB open order/status refresh is not wired yet',
        metadata: {
          capability: 'unavailable',
          reason: 'CLOB open order/status refresh is not wired yet',
        },
      },
    });
    expect(result).toMatchObject({
      runId: 'sync_run_1',
      jobType: 'order_status_refresh',
      status: 'failed',
      capability: 'unavailable',
    });
  });

  it('records an unavailable capability run for script market refresh', async () => {
    const syncRunCreate = vi.fn().mockResolvedValue({
      id: 'sync_run_2',
      jobType: 'script_market_refresh',
      status: 'failed',
    });
    const service = new MonitorService({
      syncRun: {
        create: syncRunCreate,
      },
    } as unknown as PrismaService);

    const result = await service.refreshScriptMarkets();

    expect(syncRunCreate).toHaveBeenCalledWith({
      data: {
        jobType: 'script_market_refresh',
        scope: 'scripts',
        status: 'failed',
        finishedAt: expect.any(Date) as Date,
        error: 'Script market monitoring refresh is not wired yet',
        metadata: {
          capability: 'unavailable',
          reason: 'Script market monitoring refresh is not wired yet',
        },
      },
    });
    expect(result).toMatchObject({
      runId: 'sync_run_2',
      jobType: 'script_market_refresh',
      status: 'failed',
      capability: 'unavailable',
    });
  });
});
