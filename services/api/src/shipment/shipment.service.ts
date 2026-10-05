import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ShipmentView } from '../logistics/model/shipment-view.model';
import { LOGISTICS_REPOSITORY } from '../logistics/repository/logistics-repository';
import type { LogisticsRepository } from '../logistics/repository/logistics-repository';

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

    const [supplier, product] = await Promise.all([
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
