import { Product } from '../model/product.model';
import { Shipment } from '../model/shipment.model';
import { Supplier } from '../model/supplier.model';

export const logisticsFixtureSuppliers: Supplier[] = [
  {
    id: 'SUP-001',
    name: 'Stuttgart Components GmbH',
    location: { city: 'Stuttgart', countryCode: 'DE' },
  },
  {
    id: 'SUP-002',
    name: 'Lübeck Demo Supplier',
    location: { city: 'Lübeck', countryCode: 'DE' },
  },
];

export const logisticsFixtureProducts: Product[] = [
  { id: 'PROD-001', sku: 'ECU-CTRL-01', name: 'ECU Controller' },
];

export const logisticsFixtureShipments: Shipment[] = [
  {
    id: 'SHP-001',
    supplierId: 'SUP-001',
    productId: 'PROD-001',
    quantity: 2000,
    pickupLocation: { city: 'Stuttgart', countryCode: 'DE' },
    destination: { city: 'Munich', countryCode: 'DE' },
    plannedRoute: ['A8'],
    status: 'IN_TRANSIT',
    pickupAt: new Date('2026-10-05T08:00:00.000Z'),
    plannedDeliveryAt: new Date('2026-10-05T14:00:00.000Z'),
  },
  {
    id: 'SHP-002',
    supplierId: 'SUP-002',
    productId: 'PROD-001',
    quantity: 500,
    pickupLocation: { city: 'Lübeck', countryCode: 'DE' },
    destination: { city: 'Hamburg', countryCode: 'DE' },
    plannedRoute: ['A1'],
    status: 'PLANNED',
    pickupAt: new Date('2026-10-03T06:30:00.000Z'),
    plannedDeliveryAt: new Date('2026-10-03T08:30:00.000Z'),
  },
];
