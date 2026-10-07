import { createShipmentSchema } from './create-shipment.dto';

const validRequest = {
  supplierId: 'SUP-001',
  productId: 'PROD-001',
  quantity: 25,
  pickupLocation: { city: 'Ulm', countryCode: 'de' },
  destination: { city: 'Berlin', countryCode: 'DE' },
  plannedRoute: ['a8', 'A9'],
  pickupAt: '2026-10-06T08:00:00.000Z',
  plannedDeliveryAt: '2026-10-06T14:00:00.000Z',
};

describe('createShipmentSchema', () => {
  it('normalizes the supported location and motorway inputs', () => {
    expect(createShipmentSchema.parse(validRequest)).toMatchObject({
      pickupLocation: { city: 'Ulm', countryCode: 'DE' },
      plannedRoute: ['A8', 'A9'],
    });
  });

  it('rejects client-controlled IDs and invalid delivery times', () => {
    expect(
      createShipmentSchema.safeParse({ ...validRequest, id: 'SHP-CLIENT' })
        .success,
    ).toBe(false);
    expect(
      createShipmentSchema.safeParse({
        ...validRequest,
        plannedDeliveryAt: validRequest.pickupAt,
      }).success,
    ).toBe(false);
  });
});
