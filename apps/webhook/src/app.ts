import { Hono } from 'hono'

export const app = new Hono();

app.post('/webhook', async (c) => {
    const rawBody = await c.req.text();
    const event = c.req.header('x-github-event');
    const deliveryId = c.req.header('x-github-delivery');

    const payload = JSON.parse(rawBody);

    console.log({
        event,
        deliveryId,
        action: payload.action,
        conclusion: payload.workflow_run?.conclusion,
    });
    
    return c.text('accepted', 202);
})