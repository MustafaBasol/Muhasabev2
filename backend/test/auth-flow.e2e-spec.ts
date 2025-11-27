import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { EmailService, EmailOptions } from '../src/services/email.service';
import { DataSource, Repository } from 'typeorm';
import { EmailSuppression } from '../src/email/entities/email-suppression.entity';
import { getRepositoryToken } from '@nestjs/typeorm';

// Bu e2e testi yeni email doğrulama & şifre sıfırlama akışının temel senaryolarını doğrular.
// Not: Gerçek e-posta gönderimi mock'lanmaz; MAIL_PROVIDER=log iken sadece log çıkar.

describe('Auth Flow Extended (e2e)', () => {
  let app: INestApplication;
  let server: any;
  let testEmail: string;
  let testPassword: string;
  let userId: string;
  let lastVerify: { html?: string; text?: string } | null = null;
  let lastReset: { html?: string; text?: string } | null = null;

  beforeAll(async () => {
    process.env.EMAIL_VERIFICATION_REQUIRED = 'true';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EmailService)
      .useFactory({
        inject: [getRepositoryToken(EmailSuppression)],
        factory: (suppressionRepo: Repository<EmailSuppression>) => ({
          async sendEmail(opts: EmailOptions) {
            const to = (opts.to || '').trim().toLowerCase();
            console.log('[auth-flow] mock email send', opts.subject, to);
            const suppressed = await suppressionRepo.findOne({
              where: { email: to },
            });
            if (suppressed) {
              // Bastırılmışsa capture ETME
              return false;
            }
            if (/Doğrulama|Verification|Verify/i.test(opts.subject || '')) {
              lastVerify = { html: opts.html, text: opts.text };
              console.log(
                '[auth-flow] captured verify email snippet',
                (opts.html || opts.text || '').slice(0, 200),
              );
            } else if (/Şifre Sıfırlama|Reset/i.test(opts.subject || '')) {
              lastReset = { html: opts.html, text: opts.text };
            }
            return true;
          },
        }),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should signup and return success (minimal)', async () => {
    testEmail = `flow-${Date.now()}@example.com`;
    testPassword = 'Aa1!StrongPass123';
    const res = await request(server)
      .post('/auth/signup')
      .send({
        email: testEmail,
        password: testPassword,
        firstName: 'Flow',
        lastName: 'User',
        companyName: 'Flow Co',
      })
      .expect(201);
    expect(res.body).toEqual({ success: true });
  });

  it('prevents login before verification when enforcement enabled', async () => {
    const shouldEnforce =
      (process.env.EMAIL_VERIFICATION_REQUIRED || 'false').toLowerCase() ===
      'true';
    const expected = shouldEnforce ? 401 : 200;
    await request(server)
      .post('/auth/login')
      .send({ email: testEmail, password: testPassword })
      .expect(expected);
  });

  it('should verify using captured email content', async () => {
    const raw = extractQueryParam(lastVerify, 'token');
    userId = extractQueryParam(lastVerify, 'u');
    expect(raw).toBeTruthy();
    expect(userId).toBeTruthy();
    await request(server)
      .get(`/auth/verify?token=${raw}&u=${userId}`)
      .expect(200)
      .expect((r) => expect(r.body.success).toBe(true));
  });

  it('login should succeed after verification', async () => {
    const res = await request(server)
      .post('/auth/login')
      .send({ email: testEmail, password: testPassword })
      .expect(200);
    expect(res.body).toHaveProperty('token');
  });

  it('should issue password reset token and then reset', async () => {
    const forgotRes = await request(server)
      .post('/auth/forgot')
      .send({ email: testEmail })
      .expect(201);
    expect(forgotRes.body.success).toBe(true);
    const rawReset = extractQueryParam(lastReset, 'token');
    expect(rawReset).toBeTruthy();
    const newPass = 'Bb2!NewStrong456';
    await request(server)
      .post('/auth/reset')
      .send({ token: rawReset, u: userId, newPassword: newPass })
      .expect(201)
      .expect((r) => expect(r.body.success).toBe(true));
    // Login with new password
    await request(server)
      .post('/auth/login')
      .send({ email: testEmail, password: newPass })
      .expect(200);
  });

  it('suppression prevents email send then removal allows resend', async () => {
    // 1) Manuel bastırma ekle (repo üzerinden) - e2e testte direkt erişim
    const dataSource = app.get(DataSource);
    const suppressionRepo = dataSource.getRepository(EmailSuppression);
    const supEmail = `blocked-${Date.now()}@example.com`;
    // Suppression kaydı ONCE eklenir (email henüz gönderilmeden)
    await suppressionRepo.save({
      email: supEmail.toLowerCase(),
      reason: 'manual',
    });
    // Kaydol (ilk doğrulama maili suppression nedeniyle capture edilmemeli)
    await request(server)
      .post('/auth/signup')
      .send({
        email: supEmail,
        password: 'Aa1!AnotherStrong123',
        firstName: 'Blocked',
        lastName: 'User',
        companyName: 'Blocked Co',
      })
      .expect(201);
    const beforeResendVerify = lastVerify; // null veya önceki state
    // Resend dene (hala suppression aktif)
    await request(server)
      .post('/auth/resend-verification')
      .send({ email: supEmail })
      .expect(201);
    // Beklenti: suppression nedeniyle yeni doğrulama maili yakalanmadı
    expect(lastVerify).toBe(beforeResendVerify);
    // Suppression kaldır
    await request(server)
      .delete(`/admin/suppression/${encodeURIComponent(supEmail)}`)
      .expect(200)
      .expect((r) => expect(r.body.success).toBe(true));
    // Tekrar resend
    // Cooldown'ı minimize et: 1 saniye ve kısa bekleme
    process.env.RESEND_COOLDOWN_SECONDS = '1';
    await new Promise((r) => setTimeout(r, 1100));
    await request(server)
      .post('/auth/resend-verification')
      .send({ email: supEmail })
      .expect(201);
    // Bu sefer email mock'u tetiklenmeli
    expect(lastVerify).not.toBe(beforeResendVerify);
  });
});

function extractQueryParam(
  payload: { html?: string; text?: string } | null,
  key: string,
): string {
  if (!payload) return '';
  const content = payload.html || payload.text || '';
  // Regex: capture param value until & or quote or whitespace
  const match = content.match(new RegExp(`${key}=([^&"\\s]+)`));
  if (!match) {
    console.error(
      `[auth-flow] Missing query param ${key} in email payload`,
      content,
    );
    return '';
  }
  return decodeURIComponent(match[1]);
}
