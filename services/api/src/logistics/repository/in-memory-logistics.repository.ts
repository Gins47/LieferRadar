import { Injectable } from '@nestjs/common';
import { Product } from '../model/product.model';
import { Shipment } from '../model/shipment.model';
import { Supplier } from '../model/supplier.model';

@Injectable()
export class InMemoryLogisticsRepository {
  private readonly suppliers: Supplier[] = [
    {
      id: 'SUP-001',
      name: 'Stuttgart Components GmbH',
      location: { city: 'Stuttgart', countryCode: 'DE' },
    },
  ];

  private readonly products: Product[] = [
    { id: 'PROD-001', sku: 'ECU-CTRL-01', name: 'ECU Controller' },
  ];

  private readonly shipments: Shipment[] = [
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
  ];

  findSupplierById(id: string): Supplier | undefined {
    return this.suppliers.find((supplier) => supplier.id === id);
  }

  findProductById(id: string): Product | undefined {
    return this.products.find((product) => product.id === id);
  }

  findShipmentById(id: string): Shipment | undefined {
    return this.shipments.find((shipment) => shipment.id === id);
  }
}
