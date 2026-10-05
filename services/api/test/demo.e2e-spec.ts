import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Client } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import {
  DEMO_SHIPMENT_ID,
  DemoPreparationService,
  SELECTED_WARNING_PROVIDER_ID,
  SELECTED_WARNING_SOURCE,
} from '../src/demo/demo-preparation.service';
import { NEAR_DISRUPTION_ELAPSED_SECONDS } from '../src/demo/demo.service';
import { seedLogisticsFixtures } from '../src/logistics/repository/logistics-fixture-seed';
import { getTestDatabaseUrl } from './database-test-context';

const originalEnvironment = { ...process.env };

function restoreEnvironment(): void {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnvironment)) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, originalEnvironment);
}

describe('demo positioning (e2e)', () => {
  let app: INestApplication<App> | undefined;
  let client: Client | undefined;
  let preparation: DemoPreparationService;

  beforeAll(async () => {
    client = new Client({ connectionString: getTestDatabaseUrl() });
    await client.connect();
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    await app.init();
    preparation = app.get(DemoPreparationService);
  });

  beforeEach(async () => {
    restoreEnvironment();
    await client!.query('DELETE FROM demo_vehicle_shipments');
    await client!.query('DELETE FROM demo_vehicle_state');
    await client!.query('DELETE FROM disruptions');
    await client!.query('DELETE FROM shipments');
    await client!.query('DELETE FROM products');
    await client!.query('DELETE FROM suppliers');
    await seedLogisticsFixtures(client!);
  });

  afterAll(async () => {
    restoreEnvironment();
    await app?.close();
    await client?.end();
  });

  it('returns 409 until the guarded preparation has created the scenario', () => {
    return request(app!.getHttpServer())
      .get(`/demo/shipments/${DEMO_SHIPMENT_ID}`)
      .expect(409);
  });

  it('returns the SHP-002 scenario with route provenance and the exact REPLAY warning', async () => {
    await preparation.prepare();

    return request(app!.getHttpServer())
      .get(`/demo/shipments/${DEMO_SHIPMENT_ID}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          shipment: {
            id: DEMO_SHIPMENT_ID,
            status: 'PLANNED',
            pickupLocation: { city: 'Lübeck', countryCode: 'DE' },
            destination: { city: 'Hamburg', countryCode: 'DE' },
          },
          vehicle: {
            vehicleId: 'VEH-DEMO-002',
            driver: {
              name: 'Alex Demo',
              email: 'driver-shp002@example.invalid',
            },
            elapsedSeconds: 0,
            revision: 0,
          },
          route: {
            routeHash:
              'ecd9ff4cb5c273041800dec3912bacbd5c856f7a8a522c9f63ed3477d0ee2a2a',
            provenance: {
              profile: 'driving-car',
              distanceMetres: 68242.2,
            },
          },
          warning: {
            source: SELECTED_WARNING_SOURCE,
            providerId: SELECTED_WARNING_PROVIDER_ID,
            ingestionMode: 'REPLAY',
          },
        });
        expect(response.body.route.coordinates).toHaveLength(644);
      });
  });

  it.each(['test', 'production'])(
    'keeps positioning disabled in %s even when controls are requested',
    async (nodeEnv) => {
      await preparation.prepare();
      process.env.NODE_ENV = nodeEnv;
      process.env.LIEFERRADAR_DEMO_CONTROLS_ENABLED = 'true';

      await request(app!.getHttpServer())
        .post(`/demo/shipments/${DEMO_SHIPMENT_ID}/vehicle-position`)
        .send({ position: 'NEAR_DISRUPTION', expectedRevision: 0 })
        .expect(404);
    },
  );

  it('persists the named near-disruption position and rejects stale or arbitrary input', async () => {
    await preparation.prepare();
    process.env.NODE_ENV = 'development';
    process.env.LIEFERRADAR_DEMO_CONTROLS_ENABLED = 'true';

    await request(app!.getHttpServer())
      .post(`/demo/shipments/${DEMO_SHIPMENT_ID}/vehicle-position`)
      .send({ position: 'NEAR_DISRUPTION', expectedRevision: 0 })
      .expect(201)
      .expect((response) => {
        expect(response.body).toMatchObject({
          elapsedSeconds: NEAR_DISRUPTION_ELAPSED_SECONDS,
          position: [10.326863322601533, 53.701048700082],
          simulatedAt: '2026-10-03T07:34:00.000Z',
          revision: 1,
        });
      });

    await request(app!.getHttpServer())
      .post(`/demo/shipments/${DEMO_SHIPMENT_ID}/vehicle-position`)
      .send({ position: 'START', expectedRevision: 0 })
      .expect(409);

    await request(app!.getHttpServer())
      .post(`/demo/shipments/${DEMO_SHIPMENT_ID}/vehicle-position`)
      .send({
        position: 'NEAR_DISRUPTION',
        expectedRevision: 1,
        coordinates: [10, 53],
      })
      .expect(400);

    await request(app!.getHttpServer())
      .get(`/demo/shipments/${DEMO_SHIPMENT_ID}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.vehicle).toMatchObject({
          elapsedSeconds: NEAR_DISRUPTION_ELAPSED_SECONDS,
          revision: 1,
        });
      });
  });

  it('rejects unsupported shipments and route-hash incompatibility', async () => {
    await preparation.prepare();
    process.env.NODE_ENV = 'development';
    process.env.LIEFERRADAR_DEMO_CONTROLS_ENABLED = 'true';

    await request(app!.getHttpServer())
      .post('/demo/shipments/SHP-001/vehicle-position')
      .send({ position: 'START', expectedRevision: 0 })
      .expect(404);

    await client!.query(
      `UPDATE demo_vehicle_state SET route_hash = $2 WHERE vehicle_id = $1`,
      ['VEH-DEMO-002', 'f'.repeat(64)],
    );
    await request(app!.getHttpServer())
      .get(`/demo/shipments/${DEMO_SHIPMENT_ID}`)
      .expect(409);
  });
});
