import { ProxyAgent, setGlobalDispatcher } from 'undici';

export type OutboundProxyConfig = {
  url: string;
  source: 'OUTBOUND_PROXY_URL' | 'HTTPS_PROXY' | 'HTTP_PROXY';
};

export function configureOutboundProxy(env: NodeJS.ProcessEnv = process.env): OutboundProxyConfig | null {
  const config = readOutboundProxyUrl(env);
  if (!config) return null;

  setGlobalDispatcher(new ProxyAgent(config.url));
  return config;
}

function readOutboundProxyUrl(env: NodeJS.ProcessEnv): OutboundProxyConfig | null {
  for (const source of ['OUTBOUND_PROXY_URL', 'HTTPS_PROXY', 'HTTP_PROXY'] as const) {
    const normalized = normalizeProxyUrl(env[source]);
    if (normalized) {
      return { source, url: normalized };
    }
  }
  return null;
}

function normalizeProxyUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  const url = new URL(withProtocol);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Outbound proxy URL must use http or https');
  }
  return url.toString();
}
