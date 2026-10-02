import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('/shipments/SHP-001 (GET)', () => {
    return request(app.getHttpServer())
      .get('/shipments/SHP-001')
      .expect(200)
      .expect({
        id: 'SHP-001',
        supplier: {
          id: 'SUP-001',
          name: 'Stuttgart Components GmbH',
          location: { city: 'Stuttgart', countryCode: 'DE' },
        },
        product: {
          id: 'PROD-001',
          sku: 'ECU-CTRL-01',
          name: 'ECU Controller',
        },
        quantity: 2000,
        pickupLocation: { city: 'Stuttgart', countryCode: 'DE' },
        destination: { city: 'Munich', countryCode: 'DE' },
        plannedRoute: ['A8'],
        status: 'IN_TRANSIT',
        pickupAt: '2026-10-05T08:00:00.000Z',
        plannedDeliveryAt: '2026-10-05T14:00:00.000Z',
      });
  });

  it('/shipments/unknown (GET)', () => {
    return request(app.getHttpServer()).get('/shipments/unknown').expect(404);
  });

  afterEach(async () => {
    await app.close();
  });
});
