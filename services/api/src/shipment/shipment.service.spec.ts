import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Product } from '../logistics/model/product.model';
import { Shipment } from '../logistics/model/shipment.model';
import { Supplier } from '../logistics/model/supplier.model';
import {
  LOGISTICS_REPOSITORY,
  LogisticsRepository,
} from '../logistics/repository/logistics-repository';
import { ShipmentService } from './shipment.service';

describe('ShipmentService', () => {
  const supplier: Supplier = {
    id: 'SUP-001',
    name: 'Stuttgart Components GmbH',
    location: { city: 'Stuttgart', countryCode: 'DE' },
  };
  const product: Product = {
    id: 'PROD-001',
    sku: 'ECU-CTRL-01',
    name: 'ECU Controller',
  };
  const shipment: Shipment = {
    id: 'SHP-001',
    supplierId: supplier.id,
    productId: product.id,
    quantity: 2000,
    pickupLocation: { city: 'Stuttgart', countryCode: 'DE' },
    destination: { city: 'Munich', countryCode: 'DE' },
    plannedRoute: ['A8'],
    status: 'IN_TRANSIT',
    pickupAt: new Date('2026-10-05T08:00:00.000Z'),
    plannedDeliveryAt: new Date('2026-10-05T14:00:00.000Z'),
  };

  let repository: jest.Mocked<LogisticsRepository>;
  let service: ShipmentService;

  beforeEach(async () => {
    repository = {
      findAllShipments: jest.fn(),
      findSupplierById: jest.fn(),
      findProductById: jest.fn(),
      findShipmentById: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShipmentService,
        {
          provide: LOGISTICS_REPOSITORY,
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get(ShipmentService);
  });

  it('returns a resolved shipment view', async () => {
    repository.findShipmentById.mockResolvedValue(shipment);
    repository.findSupplierById.mockResolvedValue(supplier);
    repository.findProductById.mockResolvedValue(product);

    const shipmentView = await service.getShipment('SHP-001');

    expect(shipmentView).toEqual({
      id: 'SHP-001',
      supplier,
      product,
      quantity: 2000,
      pickupLocation: { city: 'Stuttgart', countryCode: 'DE' },
      destination: { city: 'Munich', countryCode: 'DE' },
      plannedRoute: ['A8'],
      status: 'IN_TRANSIT',
      pickupAt: new Date('2026-10-05T08:00:00.000Z'),
      plannedDeliveryAt: new Date('2026-10-05T14:00:00.000Z'),
    });
  });

  it('throws not found for an unknown shipment', async () => {
    repository.findShipmentById.mockResolvedValue(undefined);

    await expect(service.getShipment('SHP-UNKNOWN')).rejects.toThrow(
      new NotFoundException('shipment not found'),
    );
  });

  it('throws an internal consistency error when the supplier is missing', async () => {
    repository.findShipmentById.mockResolvedValue(shipment);
    repository.findSupplierById.mockResolvedValue(undefined);
    repository.findProductById.mockResolvedValue(product);

    await expect(service.getShipment('SHP-001')).rejects.toThrow(
      'invalid shipment fixture relationship',
    );

    try {
      await service.getShipment('SHP-001');
    } catch (error) {
      expect(error).not.toBeInstanceOf(NotFoundException);
      expect(error).not.toBeInstanceOf(BadRequestException);
    }
  });

  it('throws an internal consistency error when the product is missing', async () => {
    repository.findShipmentById.mockResolvedValue(shipment);
    repository.findSupplierById.mockResolvedValue(supplier);
    repository.findProductById.mockResolvedValue(undefined);

    await expect(service.getShipment('SHP-001')).rejects.toThrow(
      'invalid shipment fixture relationship',
    );

    try {
      await service.getShipment('SHP-001');
    } catch (error) {
      expect(error).not.toBeInstanceOf(NotFoundException);
      expect(error).not.toBeInstanceOf(BadRequestException);
    }
  });

  it('propagates database query failures', async () => {
    const databaseError = new Error('database unavailable');
    repository.findShipmentById.mockRejectedValue(databaseError);

    await expect(service.getShipment('SHP-001')).rejects.toBe(databaseError);
  });
});
