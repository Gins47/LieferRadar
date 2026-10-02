import { Injectable, NotFoundException } from '@nestjs/common';
import { InMemoryLogisticsRepository } from '../logistics/repository/in-memory-logistics.repository';
import { ShipmentView } from '../logistics/model/shipment-view.model';

@Injectable()
export class ShipmentService {
  constructor(
    private readonly logisticsRepository: InMemoryLogisticsRepository,
  ) {}

  getShipment(id: string): ShipmentView {
    const shipment = this.logisticsRepository.findShipmentById(id);
    if (!shipment) {
      throw new NotFoundException('shipment not found');
    }

    const supplier = this.logisticsRepository.findSupplierById(
      shipment.supplierId,
    );
    const product = this.logisticsRepository.findProductById(
      shipment.productId,
    );
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
}
