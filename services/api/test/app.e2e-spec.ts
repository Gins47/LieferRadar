import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';
import { z } from 'zod';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { seedLogisticsFixtures } from '../src/logistics/repository/logistics-fixture-seed';
import { DatabaseService } from '../src/database/database.service';
import { normalizeAutobahnWarning } from '../src/integrations/autobahn/autobahn-warning.mapper';
import { PostgresDisruptionRepository } from '../src/disruption/repository/postgres-disruption.repository';
import { getTestDatabaseUrl } from './database-test-context';

const recordedAutobahnWarningsSchema = z.object({
  warning: z.array(
    z
      .object({
        identifier: z.string(),
        description: z.array(z.string()),
        geometry: z.object({
          type: z.string(),
          coordinates: z.array(z.unknown()),
        }),
      })
      .passthrough(),
  ),
});

describe('AppController (e2e)', () => {
  let app: INestApplication<App> | undefined;
  let client: Client | undefined;
  let disruptionId: string;
  const authenticA1Warnings = recordedAutobahnWarningsSchema.parse(
    JSON.parse(
      readFileSync(
        join(
          process.cwd(),
          'test/fixtures/autobahn/a1-warnings-2026-10.03.json',
        ),
        'utf8',
      ),
    ),
  );
  const authenticA1Warning = authenticA1Warnings.warning[1];

  async function closeResources(): Promise<void> {
    const application = app;
    const databaseClient = client;
    app = undefined;
    client = undefined;

    try {
      await application?.close();
    } finally {
      await databaseClient?.end();
    }
  }

  beforeAll(async () => {
    client = new Client({ connectionString: getTestDatabaseUrl() });

    try {
      await client.connect();
      await client.query('DELETE FROM demo_vehicle_shipments');
      await client.query('DELETE FROM demo_vehicle_state');
      await client.query('DELETE FROM shipments');
      await client.query('DELETE FROM products');
      await client.query('DELETE FROM suppliers');
      await client.query('DELETE FROM disruptions');
      await seedLogisticsFixtures(client);

      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleFixture.createNestApplication();
      await app.init();

      const repository = new PostgresDisruptionRepository(
        app.get(DatabaseService),
      );
      const observation = normalizeAutobahnWarning(
        authenticA1Warning,
        'A1',
        new Date('2026-10-03T07:00:00.000Z'),
      );
      disruptionId = (await repository.upsertObservation(observation))
        .disruption.id;
    } catch (error) {
      await closeResources();
      throw error;
    }
  });

  it('/ (GET)', () => {
    return request(app!.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('/shipments/SHP-001 (GET)', () => {
    return request(app!.getHttpServer())
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
    return request(app!.getHttpServer()).get('/shipments/unknown').expect(404);
  });

  it('/shipments/SHP-002 (GET)', () => {
    return request(app!.getHttpServer())
      .get('/shipments/SHP-002')
      .expect(200)
      .expect({
        id: 'SHP-002',
        supplier: {
          id: 'SUP-002',
          name: 'Lübeck Demo Supplier',
          location: { city: 'Lübeck', countryCode: 'DE' },
        },
        product: {
          id: 'PROD-001',
          sku: 'ECU-CTRL-01',
          name: 'ECU Controller',
        },
        quantity: 500,
        pickupLocation: { city: 'Lübeck', countryCode: 'DE' },
        destination: { city: 'Hamburg', countryCode: 'DE' },
        plannedRoute: ['A1'],
        status: 'PLANNED',
        pickupAt: '2026-10-03T06:30:00.000Z',
        plannedDeliveryAt: '2026-10-03T08:30:00.000Z',
      });
  });

  it('/disruptions (GET) returns the persisted warning page', () => {
    return request(app!.getHttpServer())
      .get('/disruptions?road=A1&category=WARNING&date=2026-10-03')
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          page: 1,
          limit: 20,
          total: 1,
          items: [
            expect.objectContaining({
              id: disruptionId,
              providerId: 'INRIX--vi-avl.2026-10-03_06-53-00-000_003.de0',
              category: 'WARNING',
              queriedRoad: 'A1',
              title: 'A1 | Bargteheide - Ahrensburg',
              description: authenticA1Warning.description,
              geometry: authenticA1Warning.geometry,
              rawData: authenticA1Warning,
            }),
          ],
        });
      });
  });

  it('/disruptions/:id (GET) returns the stored warning', () => {
    return request(app!.getHttpServer())
      .get(`/disruptions/${disruptionId}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          id: disruptionId,
          startTimestamp: {
            kind: 'value',
            value: '2026-10-03T06:53:00.000Z',
          },
          endTimestamp: { kind: 'omitted' },
          ingestionMode: 'LIVE',
        });
      });
  });

  it('/disruptions/:id (GET) returns 404 only for a missing valid identifier', () => {
    return request(app!.getHttpServer())
      .get('/disruptions/8dcd1a63-6a66-4aa7-b28e-8cb457f82f31')
      .expect(404);
  });

  it('/disruptions (GET) rejects invalid pagination', () => {
    return request(app!.getHttpServer()).get('/disruptions?page=0').expect(400);
  });

  it('/integrations/autobahn/collect (POST) is disabled by default', () => {
    return request(app!.getHttpServer())
      .post('/integrations/autobahn/collect')
      .send({ road: 'A1' })
      .expect(404);
  });

  afterAll(async () => {
    await closeResources();
  });
});
