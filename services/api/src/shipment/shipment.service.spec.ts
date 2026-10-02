import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InMemoryLogisticsRepository } from '../logistics/repository/in-memory-logistics.repository';
import { ShipmentService } from './shipment.service';

describe('ShipmentService', () => {
  let repository: InMemoryLogisticsRepository;
  let service: ShipmentService;

  beforeEach(() => {
    repository = new InMemoryLogisticsRepository();
    service = new ShipmentService(repository);
  });

  it('provides a valid Stuttgart to Munich fixture', () => {
    const shipment = repository.findShipmentById('SHP-001');

    expect(shipment).toMatchObject({
      id: 'SHP-001',
      supplierId: 'SUP-001',
      productId: 'PROD-001',
      quantity: 2000,
      pickupLocation: { city: 'Stuttgart', countryCode: 'DE' },
      destination: { city: 'Munich', countryCode: 'DE' },
      plannedRoute: ['A8'],
      status: 'IN_TRANSIT',
    });
    expect(shipment?.plannedRoute).not.toHaveLength(0);
    expect(shipment?.plannedDeliveryAt.getTime()).toBeGreaterThan(
      shipment?.pickupAt.getTime() ?? 0,
    );
    expect(repository.findSupplierById(shipment?.supplierId ?? '')).toMatchObject({
      id: 'SUP-001',
      name: 'Stuttgart Components GmbH',
      location: { city: 'Stuttgart', countryCode: 'DE' },
    });
    expect(repository.findProductById(shipment?.productId ?? '')).toMatchObject({
      id: 'PROD-001',
      sku: 'ECU-CTRL-01',
      name: 'ECU Controller',
    });
  });

  it('returns a resolved shipment view', () => {
    const shipment = service.getShipment('SHP-001');

    expect(shipment.id).toBe('SHP-001');
    expect(shipment.supplier).toEqual({
      id: 'SUP-001',
      name: 'Stuttgart Components GmbH',
      location: { city: 'Stuttgart', countryCode: 'DE' },
    });
    expect(shipment.product).toEqual({
      id: 'PROD-001',
      sku: 'ECU-CTRL-01',
      name: 'ECU Controller',
    });
    expect(shipment.quantity).toBe(2000);
    expect(shipment.pickupLocation).toEqual({
      city: 'Stuttgart',
      countryCode: 'DE',
    });
    expect(shipment.destination).toEqual({ city: 'Munich', countryCode: 'DE' });
    expect(shipment.plannedRoute).toEqual(['A8']);
    expect(shipment.plannedRoute).not.toHaveLength(0);
    expect(shipment.status).toBe('IN_TRANSIT');
    expect(shipment.pickupAt.toISOString()).toBe('2026-10-05T08:00:00.000Z');
    expect(shipment.plannedDeliveryAt.toISOString()).toBe(
      '2026-10-05T14:00:00.000Z',
    );
    expect(shipment.plannedDeliveryAt.getTime()).toBeGreaterThan(
      shipment.pickupAt.getTime(),
    );
  });

  it('throws not found for an unknown shipment', () => {
    expect(() => service.getShipment('SHP-UNKNOWN')).toThrow(NotFoundException);
  });

  it('throws an internal consistency error when the supplier is missing', () => {
    jest.spyOn(repository, 'findSupplierById').mockReturnValue(undefined);

    expect(() => service.getShipment('SHP-001')).toThrow(
      'invalid shipment fixture relationship',
    );

    try {
      service.getShipment('SHP-001');
    } catch (error) {
      expect(error).not.toBeInstanceOf(NotFoundException);
      expect(error).not.toBeInstanceOf(BadRequestException);
    }
  });

  it('throws an internal consistency error when the product is missing', () => {
    jest.spyOn(repository, 'findProductById').mockReturnValue(undefined);

    expect(() => service.getShipment('SHP-001')).toThrow(
      'invalid shipment fixture relationship',
    );

    try {
      service.getShipment('SHP-001');
    } catch (error) {
      expect(error).not.toBeInstanceOf(NotFoundException);
      expect(error).not.toBeInstanceOf(BadRequestException);
    }
  });
});
