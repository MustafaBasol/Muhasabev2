import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import Stripe from 'stripe';
import { BillingService } from '../billing/billing.service';

@SkipThrottle()
@Controller('webhooks/stripe')
export class StripeWebhookController {
  private stripe: Stripe;
  private webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

  constructor(private readonly billing: BillingService) {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
      throw new Error('STRIPE_SECRET_KEY is not set');
    }
    this.stripe = new Stripe(apiKey, { apiVersion: '2023-10-16' });
  }

  // Not: main.ts içinde bu route için raw body gerekecek; burada sadece tipi any kabul ediyoruz.
  @Post()
  @HttpCode(200)
  async handle(
    @Req() req: Request,
    @Res() res: Response,
    @Headers('stripe-signature') sig: string,
  ) {
    let event: Stripe.Event;
    try {
      const bodyAny: any = (req as any).body;
      const buf: Buffer | string = Buffer.isBuffer(bodyAny)
        ? bodyAny
        : (req as any).rawBody ||
          (req as any).bodyRaw ||
          JSON.stringify(req.body);
      event = this.stripe.webhooks.constructEvent(buf, sig, this.webhookSecret);
    } catch (err: any) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          if (session.subscription) {
            const subId =
              typeof session.subscription === 'string'
                ? session.subscription
                : session.subscription.id;
            const sub = await this.stripe.subscriptions.retrieve(subId);
            await this.billing.applySubscriptionUpdateFromStripe(sub);
          }
          break;
        }
        case 'customer.subscription.updated':
        case 'customer.subscription.created':
        case 'customer.subscription.resumed':
        case 'customer.subscription.paused':
        case 'customer.subscription.deleted': {
          const sub = event.data.object;
          await this.billing.applySubscriptionUpdateFromStripe(sub);
          break;
        }
        default:
          // ignore others
          break;
      }
    } catch (e) {
      // Swallow to avoid retries storms; Stripe will retry on non-2xx.
      console.error('Stripe webhook handler error:', e);
      return res.status(200).send('ok');
    }

    return res.status(200).send('ok');
  }
}
