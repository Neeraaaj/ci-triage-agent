import { NodeSDK } from '@opentelemetry/sdk-node';
import { LangfuseSpanProcessor } from '@langfuse/otel';

let processor: LangfuseSpanProcessor | undefined;

export function initTracing() {
  if (processor) return;                                        // once per Lambda instance
  if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY) {
    console.log({ msg: 'tracing disabled: no Langfuse keys' }); // degrade, don't crash
    return;
  }
  processor = new LangfuseSpanProcessor({ exportMode: 'immediate' });
  new NodeSDK({ spanProcessors: [processor] }).start();
}

export async function flushTracing() {
  await processor?.forceFlush();
}