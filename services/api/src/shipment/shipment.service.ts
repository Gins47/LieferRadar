import { randomUUID } from 'node:crypto';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Product } from '../logistics/model/product.model';
import { Shipment } from '../logistics/model/shipment.model';
import { ShipmentView } from '../logistics/model/shipment-view.model';
import { Supplier } from '../logistics/model/supplier.model';
import { LOGISTICS_REPOSITORY } from '../logistics/repository/logistics-repository';
import type { LogisticsRepository } from '../logistics/repository/logistics-repository';
import { CreateShipmentRequest } from './create-shipment.dto';

@Injectable()
export class ShipmentService {
  constructor(
    @Inject(LOGISTICS_REPOSITORY)
    private readonly logisticsRepository: LogisticsRepository,
  ) {}

  async getShipment(id: string): Promise<ShipmentView> {
    const shipment = await this.logisticsRepository.findShipmentById(id);
    if (!shipment) {
      throw new NotFoundException('shipment not found');
    }

    return this.toShipmentView(shipment);
  }

  async createShipment(request: CreateShipmentRequest): Promise<ShipmentView> {
    const [supplier, product] = await Promise.all([
      this.logisticsRepository.findSupplierById(request.supplierId),
      this.logisticsRepository.findProductById(request.productId),
    ]);
    if (!supplier || !product) {
      throw new NotFoundException(
        !supplier ? 'supplier not found' : 'product not found',
      );
    }

    const shipment: Shipment = await this.logisticsRepository.createShipment({
      id: `SHP-${randomUUID()}`,
      supplierId: request.supplierId,
      productId: request.productId,
      quantity: request.quantity,
      pickupLocation: request.pickupLocation,
      destination: request.destination,
      plannedRoute: request.plannedRoute,
      status: 'PLANNED',
      pickupAt: new Date(request.pickupAt),
      plannedDeliveryAt: new Date(request.plannedDeliveryAt),
    });

    return this.toShipmentView(shipment, supplier, product);
  }

  private async toShipmentView(
    shipment: Shipment,
    resolvedSupplier?: Supplier,
    resolvedProduct?: Product,
  ): Promise<ShipmentView> {
    const [supplier, product] =
      resolvedSupplier && resolvedProduct
        ? [resolvedSupplier, resolvedProduct]
        : await Promise.all([
            this.logisticsRepository.findSupplierById(shipment.supplierId),
            this.logisticsRepository.findProductById(shipment.productId),
          ]);
    if (!supplier || !product) {
      throw new Error('invalid shipment fixture relationship');
    }

    return {
      id: shipment.id,
      supplier,
      product,
      quantity: shipment.quantity,
      pickupLocation: shipment.pickupLocation,
      destination: shipment.destination,
      plannedRoute: shipment.plannedRoute,
      status: shipment.status,
      pickupAt: shipment.pickupAt,
      plannedDeliveryAt: shipment.plannedDeliveryAt,
    };
  }

  async getShipments(): Promise<ShipmentView[]> {
    const shipments = await this.logisticsRepository.findAllShipments();
    return Promise.all(
      shipments.map((shipment) => this.getShipment(shipment.id)),
    );
  }
}
